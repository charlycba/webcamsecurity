const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const switchBtn = document.getElementById("switchBtn");
const snapshotBtn = document.getElementById("snapshotBtn");
const autoUpload = document.getElementById("autoUpload");
const qualitySelect = document.getElementById("qualitySelect");
const statusEl = document.getElementById("status");

let stream = null;
let usingFront = false;
let uploadTimer = null;
let liveTimer = null;
let liveSocket = null;

const QUALITY_PRESETS = {
  low: {
    label: "Baja",
    width: 640,
    height: 360,
    frameRate: 15,
    jpegQuality: 0.7,
    intervalMs: 200
  },
  medium: {
    label: "Media",
    width: 1280,
    height: 720,
    frameRate: 24,
    jpegQuality: 0.85,
    intervalMs: 120
  },
  high: {
    label: "Alta",
    width: 1920,
    height: 1080,
    frameRate: 30,
    jpegQuality: 0.92,
    intervalMs: 100
  }
};

const QUALITY_ORDER = ["low", "medium", "high"];
let currentQuality = "medium";
let autoQuality = false;
let qualityIndex = 1;
let autoMetrics = {
  encodeMs: 0,
  sendDelayMs: 0,
  lastFrameAt: 0
};

function setStatus(message) {
  statusEl.textContent = message;
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
    snapshotBtn.disabled = false;
    startLiveStream();
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
  snapshotBtn.disabled = true;
  stopAutoUpload();
  stopLiveStream();
  setStatus("Camara detenida.");
}

async function switchCamera() {
  usingFront = !usingFront;
  stopCamera();
  await startCamera();
}

function captureDataUrl() {
  if (!stream) {
    return null;
  }
  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings();
  const preset = QUALITY_PRESETS[currentQuality];
  const width = settings.width || preset.width;
  const height = settings.height || preset.height;

  const targetWidth = Math.min(width, preset.width);
  const targetHeight = Math.round(height * (targetWidth / width));

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL("image/jpeg", preset.jpegQuality);
}

async function uploadSnapshot() {
  const dataUrl = captureDataUrl();
  if (!dataUrl) {
    return;
  }

  try {
    const res = await fetch("/api/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl })
    });

    if (!res.ok) {
      throw new Error("upload failed");
    }
    setStatus("Snapshot enviado.");
  } catch (error) {
    console.error(error);
    setStatus("Fallo al enviar snapshot.");
  }
}

function startAutoUpload() {
  stopAutoUpload();
  uploadTimer = setInterval(uploadSnapshot, 5000);
  setStatus("Auto snapshot activo.");
}

function stopAutoUpload() {
  if (uploadTimer) {
    clearInterval(uploadTimer);
    uploadTimer = null;
  }
  autoUpload.checked = false;
}

function openLiveSocket() {
  if (liveSocket) {
    return;
  }
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  liveSocket = new WebSocket(`${protocol}://${window.location.host}`);

  liveSocket.addEventListener("open", () => {
    setStatus("Streaming en vivo activo.");
  });

  liveSocket.addEventListener("close", () => {
    liveSocket = null;
  });

  liveSocket.addEventListener("error", () => {
    setStatus("Error en streaming en vivo.");
  });
}

function startLiveStream() {
  if (liveTimer) {
    return;
  }

  openLiveSocket();
  liveTimer = setInterval(() => {
    if (!stream || !liveSocket || liveSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    if (video.readyState < 2) {
      return;
    }
    const startedAt = performance.now();
    const dataUrl = captureDataUrl();
    const encodedAt = performance.now();
    autoMetrics.encodeMs = encodedAt - startedAt;
    if (dataUrl) {
      const sinceLast = autoMetrics.lastFrameAt ? (startedAt - autoMetrics.lastFrameAt) : 0;
      autoMetrics.lastFrameAt = startedAt;
      autoMetrics.sendDelayMs = sinceLast;
      liveSocket.send(JSON.stringify({ type: "frame", dataUrl }));
    }
  }, QUALITY_PRESETS[currentQuality].intervalMs);
}

function stopLiveStream() {
  if (liveTimer) {
    clearInterval(liveTimer);
    liveTimer = null;
  }
  if (liveSocket) {
    liveSocket.close();
    liveSocket = null;
  }
}

function applyQuality(key) {
  currentQuality = key;
  qualityIndex = QUALITY_ORDER.indexOf(key);
}

async function reconfigureQuality(key) {
  applyQuality(key);
  if (stream) {
    stopCamera();
    await startCamera();
  }
}

function autoTuneQuality() {
  if (!autoQuality || !stream) {
    return;
  }

  const preset = QUALITY_PRESETS[currentQuality];
  const interval = preset.intervalMs;
  const encodeBudget = interval * 0.65;
  const bufferPressure = liveSocket ? liveSocket.bufferedAmount : 0;

  const shouldDecrease = autoMetrics.encodeMs > encodeBudget || bufferPressure > 5_000_000;
  const shouldIncrease = autoMetrics.encodeMs < encodeBudget * 0.55 && bufferPressure < 1_000_000;

  if (shouldDecrease && qualityIndex > 0) {
    qualityIndex -= 1;
    reconfigureQuality(QUALITY_ORDER[qualityIndex]);
    return;
  }

  if (shouldIncrease && qualityIndex < QUALITY_ORDER.length - 1) {
    qualityIndex += 1;
    reconfigureQuality(QUALITY_ORDER[qualityIndex]);
  }
}

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);
switchBtn.addEventListener("click", switchCamera);
snapshotBtn.addEventListener("click", uploadSnapshot);
autoUpload.addEventListener("change", (event) => {
  if (event.target.checked) {
    startAutoUpload();
  } else {
    stopAutoUpload();
  }
});

qualitySelect.addEventListener("change", async (event) => {
  const value = event.target.value;
  autoQuality = value === "auto";
  if (autoQuality) {
    await reconfigureQuality(QUALITY_ORDER[qualityIndex]);
    return;
  }
  await reconfigureQuality(value);
});

setInterval(autoTuneQuality, 3000);

if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  setStatus("Este navegador no soporta getUserMedia.");
}
