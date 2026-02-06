const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const switchBtn = document.getElementById("switchBtn");
const qualitySelect = document.getElementById("qualitySelect");
const statusEl = document.getElementById("status");

let stream = null;
let usingFront = false;
let liveTimer = null;
let liveSocket = null;
let qualityChangeInProgress = false;
const MAX_BUFFERED_BYTES = 2_000_000;
const USE_BINARY_FRAMES = true;

const QUALITY_PRESETS = {
  low: {
    label: "Baja",
    width: 480,
    height: 270,
    frameRate: 12,
    jpegQuality: 0.6,
    intervalMs: 120
  },
  medium: {
    label: "Media",
    width: 960,
    height: 540,
    frameRate: 18,
    jpegQuality: 0.75,
    intervalMs: 100
  },
  high: {
    label: "Alta",
    width: 1280,
    height: 720,
    frameRate: 24,
    jpegQuality: 0.82,
    intervalMs: 80
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

function captureBlob() {
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

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", preset.jpegQuality);
  });
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
  const runLoop = async () => {
    if (!stream || !liveSocket || liveSocket.readyState !== WebSocket.OPEN) {
      liveTimer = setTimeout(runLoop, QUALITY_PRESETS[currentQuality].intervalMs);
      return;
    }
    if (liveSocket.bufferedAmount > MAX_BUFFERED_BYTES) {
      liveTimer = setTimeout(runLoop, QUALITY_PRESETS[currentQuality].intervalMs);
      return;
    }
    if (video.readyState < 2) {
      liveTimer = setTimeout(runLoop, QUALITY_PRESETS[currentQuality].intervalMs);
      return;
    }
    const startedAt = performance.now();
    const dataUrl = USE_BINARY_FRAMES ? null : captureDataUrl();
    const blob = USE_BINARY_FRAMES ? await captureBlob() : null;
    const encodedAt = performance.now();
    autoMetrics.encodeMs = encodedAt - startedAt;
    if (dataUrl || blob) {
      if (liveSocket.bufferedAmount <= MAX_BUFFERED_BYTES) {
        const sinceLast = autoMetrics.lastFrameAt ? (startedAt - autoMetrics.lastFrameAt) : 0;
        autoMetrics.lastFrameAt = startedAt;
        autoMetrics.sendDelayMs = sinceLast;
        const preset = QUALITY_PRESETS[currentQuality];
        const mode = autoQuality ? "Auto" : "Manual";
        const qualityLabel = preset ? preset.label : "Desconocida";
        liveSocket.send(JSON.stringify({
          type: "meta",
          meta: {
            quality: qualityLabel,
            mode,
            ts: Date.now()
          }
        }));
        if (blob) {
          liveSocket.send(blob);
        } else if (dataUrl) {
          liveSocket.send(JSON.stringify({
            type: "frame",
            dataUrl,
            quality: qualityLabel,
            mode
          }));
        }
      }
    }
    liveTimer = setTimeout(runLoop, QUALITY_PRESETS[currentQuality].intervalMs);
  };

  runLoop();
}

function restartLiveInterval() {
  if (liveTimer) {
    clearTimeout(liveTimer);
    liveTimer = null;
  }
  if (stream) {
    startLiveStream();
  }
}

function stopLiveStream() {
  if (liveTimer) {
    clearTimeout(liveTimer);
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

async function applyStreamQuality(key) {
  if (qualityChangeInProgress) {
    return;
  }

  const preset = QUALITY_PRESETS[key];
  if (!preset) {
    return;
  }

  qualityChangeInProgress = true;
  applyQuality(key);

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

  restartLiveInterval();
  setStatus(`Calidad ${preset.label}${autoQuality ? " (Auto)" : ""}.`);
  qualityChangeInProgress = false;
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
    applyStreamQuality(QUALITY_ORDER[qualityIndex]);
    return;
  }

  if (shouldIncrease && qualityIndex < QUALITY_ORDER.length - 1) {
    qualityIndex += 1;
    applyStreamQuality(QUALITY_ORDER[qualityIndex]);
  }
}

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);
switchBtn.addEventListener("click", switchCamera);

qualitySelect.addEventListener("change", async (event) => {
  const value = event.target.value;
  autoQuality = value === "auto";
  if (autoQuality) {
    await applyStreamQuality(QUALITY_ORDER[qualityIndex]);
    return;
  }
  await applyStreamQuality(value);
});

setInterval(autoTuneQuality, 3000);

if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  setStatus("Este navegador no soporta getUserMedia.");
}
