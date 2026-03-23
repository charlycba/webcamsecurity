const video = document.getElementById("video");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const switchBtn = document.getElementById("switchBtn");
const qualitySelect = document.getElementById("qualitySelect");
const statusEl = document.getElementById("status");

let stream = null;
let usingFront = false;
let signalSocket = null;
let rtcPeer = null;
let rtcSender = null;
let rtcDataChannel = null;
let rtcMetaTimer = null;
let snapshotTimer = null;
let snapshotUploadInFlight = false;
let renegotiationInProgress = false;
let pendingRenegotiation = false;
let awaitingAnswer = false;
let signalReconnectTimer = null;
const snapshotCanvas = document.createElement("canvas");
let currentQuality = "medium";

const QUALITY_PRESETS = {
  low: {
    label: "Baja",
    width: 640,
    height: 360,
    frameRate: 60,
    maxBitrate: 1_500_000
  },
  medium: {
    label: "Media",
    width: 1280,
    height: 720,
    frameRate: 60,
    maxBitrate: 3_500_000
  },
  high: {
    label: "Alta",
    width: 1920,
    height: 1080,
    frameRate: 30,
    maxBitrate: 6_000_000
  }
};

function setStatus(message) {
  statusEl.textContent = message;
}

function stopSnapshotLoop() {
  if (snapshotTimer) {
    clearInterval(snapshotTimer);
    snapshotTimer = null;
  }
}

function blobToArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

async function pushSnapshotFrame() {
  if (!stream || !video.srcObject || video.readyState < 2 || snapshotUploadInFlight) {
    return;
  }

  const width = video.videoWidth || 0;
  const height = video.videoHeight || 0;
  if (width === 0 || height === 0) {
    return;
  }

  snapshotUploadInFlight = true;
  try {
    snapshotCanvas.width = width;
    snapshotCanvas.height = height;
    const ctx = snapshotCanvas.getContext("2d", { alpha: false });
    if (!ctx) {
      return;
    }
    ctx.drawImage(video, 0, 0, width, height);

    let payload = null;
    if (typeof snapshotCanvas.toBlob === "function") {
      payload = await new Promise((resolve) => {
        snapshotCanvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
      });
    }

    if (!payload) {
      const dataUrl = snapshotCanvas.toDataURL("image/jpeg", 0.85);
      const base64 = dataUrl.split(",")[1];
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) {
        bytes[i] = bin.charCodeAt(i);
      }
      payload = bytes.buffer;
    } else {
      payload = await blobToArrayBuffer(payload);
    }

    await fetch("/api/snapshot-frame", {
      method: "POST",
      headers: {
        "Content-Type": "image/jpeg"
      },
      body: payload
    });
  } catch (_error) {
    return;
  } finally {
    snapshotUploadInFlight = false;
  }
}

function startSnapshotLoop() {
  if (snapshotTimer) {
    return;
  }
  snapshotTimer = setInterval(() => {
    pushSnapshotFrame();
  }, 1000);
}

async function startCamera() {
  try {
    const preset = QUALITY_PRESETS[currentQuality];
    const constraints = {
      audio: false,
      video: {
        facingMode: usingFront ? "user" : "environment",
        width: { ideal: preset.width },
        height: { ideal: preset.height },
        frameRate: { ideal: preset.frameRate, max: preset.frameRate }
      }
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    switchBtn.disabled = false;
    await startWebRtc();
    startSnapshotLoop();
    setStatus("Camara activa.");
  } catch (error) {
    console.error(error);
    setStatus("No se pudo acceder a la camara. Revisa permisos y HTTPS.");
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  video.srcObject = null;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  switchBtn.disabled = true;
  stopSnapshotLoop();
  stopWebRtc();
  if (signalReconnectTimer) {
    clearTimeout(signalReconnectTimer);
    signalReconnectTimer = null;
  }
  if (signalSocket) {
    signalSocket.close();
    signalSocket = null;
  }
  setStatus("Camara detenida.");
}

async function switchCamera() {
  usingFront = !usingFront;
  stopCamera();
  await startCamera();
}

function openSignalSocket() {
  if (signalSocket) {
    return;
  }
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  signalSocket = new WebSocket(`${protocol}://${window.location.host}`);

  signalSocket.addEventListener("message", async (event) => {
    let payload = null;
    try {
      payload = JSON.parse(event.data);
    } catch (_error) {
      return;
    }

    if (payload && payload.type === "webrtc-answer" && rtcPeer) {
      awaitingAnswer = false;
      await rtcPeer.setRemoteDescription(payload.sdp);
      return;
    }

    if (payload && payload.type === "viewer-ready" && stream) {
      if (awaitingAnswer) {
        return;
      }
      await triggerRenegotiation();
      return;
    }

    if (payload && payload.type === "webrtc-ice" && rtcPeer && payload.candidate) {
      try {
        await rtcPeer.addIceCandidate(payload.candidate);
      } catch (_error) {
        return;
      }
    }
  });

  signalSocket.addEventListener("close", () => {
    signalSocket = null;
    stopWebRtc();
    scheduleSignalReconnect();
  });

  signalSocket.addEventListener("error", () => {
    setStatus("Error en signaling.");
    scheduleSignalReconnect();
  });
}

function sendSignal(payload) {
  if (signalSocket && signalSocket.readyState === WebSocket.OPEN) {
    signalSocket.send(JSON.stringify(payload));
  }
}

function scheduleSignalReconnect() {
  if (!stream || signalReconnectTimer) {
    return;
  }
  signalReconnectTimer = setTimeout(async () => {
    signalReconnectTimer = null;
    try {
      openSignalSocket();
      await triggerRenegotiation();
    } catch (error) {
      console.warn("No se pudo reconectar signaling.", error);
      scheduleSignalReconnect();
    }
  }, 1200);
}

async function triggerRenegotiation() {
  if (!stream) {
    return;
  }
  if (renegotiationInProgress) {
    pendingRenegotiation = true;
    return;
  }

  renegotiationInProgress = true;
  try {
    await startWebRtc();
  } catch (error) {
    console.warn("Renegociacion WebRTC fallida.", error);
  } finally {
    renegotiationInProgress = false;
  }

  if (pendingRenegotiation) {
    pendingRenegotiation = false;
    await triggerRenegotiation();
  }
}

function startRtcMetaLoop() {
  if (rtcMetaTimer) {
    return;
  }
  rtcMetaTimer = setInterval(() => {
    if (!rtcDataChannel || rtcDataChannel.readyState !== "open") {
      return;
    }
    const preset = QUALITY_PRESETS[currentQuality];
    rtcDataChannel.send(JSON.stringify({
      type: "meta",
      meta: {
        quality: preset ? preset.label : "Desconocida",
        ts: Date.now()
      }
    }));
  }, 1000);
}

function stopRtcMetaLoop() {
  if (rtcMetaTimer) {
    clearInterval(rtcMetaTimer);
    rtcMetaTimer = null;
  }
}

async function applySenderParameters() {
  if (!rtcSender) {
    return;
  }
  const preset = QUALITY_PRESETS[currentQuality];
  const params = rtcSender.getParameters();
  if (!params.encodings || params.encodings.length === 0) {
    params.encodings = [{}];
  }
  params.encodings[0].maxBitrate = preset.maxBitrate;
  params.encodings[0].maxFramerate = preset.frameRate;
  params.encodings[0].priority = "high";
  params.degradationPreference = "maintain-framerate";

  try {
    await rtcSender.setParameters(params);
  } catch (error) {
    console.warn("No se pudo aplicar parametros de WebRTC.", error);
  }
}

async function updateIceInfo() {
  if (!rtcPeer) {
    return;
  }
  const stats = await rtcPeer.getStats();
  let selectedPair = null;
  stats.forEach((report) => {
    if (report.type === "candidate-pair" && (report.selected || report.nominated)) {
      selectedPair = report;
    }
  });

  if (!selectedPair) {
    return;
  }

  const localCandidate = stats.get(selectedPair.localCandidateId);
  const remoteCandidate = stats.get(selectedPair.remoteCandidateId);
  const localType = localCandidate ? localCandidate.candidateType : "desconocido";
  const remoteType = remoteCandidate ? remoteCandidate.candidateType : "desconocido";

  if (localType === "relay" || remoteType === "relay") {
    setStatus("WebRTC conectado. ICE relay detectado.");
    return;
  }

  setStatus(`WebRTC conectado. ICE ${localType}/${remoteType}.`);
}

async function startWebRtc() {
  if (!stream) {
    return;
  }

  openSignalSocket();
  if (!signalSocket) {
    return;
  }

  if (signalSocket.readyState !== WebSocket.OPEN) {
    await new Promise((resolve) => {
      const handler = () => {
        signalSocket.removeEventListener("open", handler);
        resolve();
      };
      signalSocket.addEventListener("open", handler);
    });
  }

  stopWebRtc();

  rtcPeer = new RTCPeerConnection({
    iceServers: [],
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require"
  });

  rtcPeer.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal({ type: "webrtc-ice", candidate: event.candidate });
    }
  };

  rtcPeer.onconnectionstatechange = () => {
    if (rtcPeer.connectionState === "connected") {
      updateIceInfo();
    }
  };

  const track = stream.getVideoTracks()[0];
  if (track) {
    track.contentHint = "motion";
    rtcSender = rtcPeer.addTrack(track, stream);
    await applySenderParameters();
  }

  rtcDataChannel = rtcPeer.createDataChannel("meta", { ordered: false, maxRetransmits: 0 });
  rtcDataChannel.addEventListener("open", startRtcMetaLoop);
  rtcDataChannel.addEventListener("close", stopRtcMetaLoop);

  const offer = await rtcPeer.createOffer({ offerToReceiveVideo: false, offerToReceiveAudio: false });
  await rtcPeer.setLocalDescription(offer);
  awaitingAnswer = true;
  sendSignal({ type: "webrtc-offer", sdp: rtcPeer.localDescription });
}

function stopWebRtc() {
  stopRtcMetaLoop();
  awaitingAnswer = false;
  if (rtcDataChannel) {
    rtcDataChannel.close();
    rtcDataChannel = null;
  }
  if (rtcPeer) {
    rtcPeer.close();
    rtcPeer = null;
  }
  rtcSender = null;
}

async function applyStreamQuality(key) {
  const preset = QUALITY_PRESETS[key];
  if (!preset) {
    return;
  }
  currentQuality = key;

  if (stream) {
    const track = stream.getVideoTracks()[0];
    if (track && typeof track.applyConstraints === "function") {
      try {
        await track.applyConstraints({
          width: { ideal: preset.width },
          height: { ideal: preset.height },
          frameRate: { ideal: preset.frameRate, max: preset.frameRate }
        });
      } catch (error) {
        console.warn("No se pudo ajustar la calidad en vivo.", error);
      }
    }
  }

  await applySenderParameters();
  setStatus(`Calidad ${preset.label}.`);
}

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);
switchBtn.addEventListener("click", switchCamera);

qualitySelect.addEventListener("change", async (event) => {
  await applyStreamQuality(event.target.value);
});

if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  setStatus("Este navegador no soporta getUserMedia.");
}
