const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const switchBtn = document.getElementById("switchBtn");
const snapshotBtn = document.getElementById("snapshotBtn");
const autoUpload = document.getElementById("autoUpload");
const statusEl = document.getElementById("status");

let stream = null;
let usingFront = false;
let uploadTimer = null;

function setStatus(message) {
  statusEl.textContent = message;
}

async function startCamera() {
  try {
    const constraints = {
      audio: false,
      video: {
        facingMode: usingFront ? "user" : "environment"
      }
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    switchBtn.disabled = false;
    snapshotBtn.disabled = false;
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
  const width = settings.width || 1280;
  const height = settings.height || 720;

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.8);
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

if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  setStatus("Este navegador no soporta getUserMedia.");
}
