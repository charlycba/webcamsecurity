const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { spawn } = require("child_process");
const express = require("express");
const { WebSocketServer, WebSocket } = require("ws");

const app = express();
const httpsPort = Number(process.env.PORT || 8443);
const httpPort = Number(process.env.HTTP_PORT || 8080);
const snapshotSource = process.env.SNAPSHOT_SOURCE || process.env.RTSP_URL || "/dev/video0";
const snapshotTimeoutMs = Number(process.env.SNAPSHOT_TIMEOUT_MS || 5000);
const snapshotMaxAgeMs = Number(process.env.SNAPSHOT_MAX_AGE_MS || 15000);
const certPath = process.env.CERT_PATH || path.join(__dirname, "certs", "local.crt");
const keyPath = process.env.KEY_PATH || path.join(__dirname, "certs", "local.key");

let latestSnapshotBuffer = null;
let latestSnapshotTs = 0;

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error("Missing TLS cert or key. Provide certs/local.crt and certs/local.key.");
  process.exit(1);
}

app.use(express.static(path.join(__dirname, "public")));
app.use("/vendor", express.static(path.join(__dirname, "node_modules", "qrcodejs")));

app.get(["/monitor", "/monitor.htm"], (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "monitor.html"));
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.post("/api/snapshot-frame", express.raw({ type: "image/jpeg", limit: "8mb" }), (req, res) => {
  if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(400).json({ error: "Empty snapshot payload" });
    return;
  }

  latestSnapshotBuffer = Buffer.from(req.body);
  latestSnapshotTs = Date.now();

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(204).end();
});

app.get("/api/snapshot", (req, res) => {
  const snapshotAge = Date.now() - latestSnapshotTs;
  if (latestSnapshotBuffer && snapshotAge <= snapshotMaxAgeMs) {
    res.status(200);
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(latestSnapshotBuffer);
    return;
  }

  if (!snapshotSource) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(503).json({ error: "Camera not available" });
    return;
  }

  const ffmpegArgs = [];
  if (snapshotSource.startsWith("/dev/video")) {
    ffmpegArgs.push("-f", "v4l2");
  }
  ffmpegArgs.push("-i", snapshotSource, "-frames:v", "1", "-q:v", "2", "-f", "image2", "pipe:1");

  const ffmpeg = spawn("ffmpeg", ffmpegArgs, {
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  let responseStarted = false;
  let timedOut = false;

  const finishWithCameraUnavailable = () => {
    if (res.headersSent || res.writableEnded) {
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(503).json({ error: "Camera not available" });
  };

  const finishWithInternalError = () => {
    if (res.headersSent || res.writableEnded) {
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(500).json({ error: "Snapshot capture failed" });
  };

  const killFfmpeg = () => {
    if (!ffmpeg.killed) {
      ffmpeg.kill("SIGKILL");
    }
  };

  const timeout = setTimeout(() => {
    timedOut = true;
    killFfmpeg();
    if (!responseStarted) {
      finishWithCameraUnavailable();
    }
  }, snapshotTimeoutMs);

  req.on("close", () => {
    killFfmpeg();
  });

  ffmpeg.stderr.on("data", (chunk) => {
    if (stderr.length < 8192) {
      stderr += chunk.toString();
    }
  });

  ffmpeg.on("error", (error) => {
    clearTimeout(timeout);
    console.error("Snapshot FFmpeg error:", error);
    finishWithInternalError();
  });

  ffmpeg.stdout.once("data", (firstChunk) => {
    if (res.writableEnded) {
      killFfmpeg();
      return;
    }
    responseStarted = true;
    res.status(200);
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.write(firstChunk);
    ffmpeg.stdout.pipe(res);
  });

  ffmpeg.on("close", (code) => {
    clearTimeout(timeout);

    if (responseStarted || res.headersSent || res.writableEnded) {
      return;
    }

    const lowerErr = stderr.toLowerCase();
    const cameraUnavailable = timedOut
      || lowerErr.includes("no such file or directory")
      || lowerErr.includes("input/output error")
      || lowerErr.includes("connection refused")
      || lowerErr.includes("timed out")
      || lowerErr.includes("could not find")
      || lowerErr.includes("device or resource busy")
      || lowerErr.includes("invalid data found when processing input")
      || code === 1;

    if (cameraUnavailable) {
      finishWithCameraUnavailable();
      return;
    }

    finishWithInternalError();
  });
});

const httpsServer = https.createServer({
  cert: fs.readFileSync(certPath),
  key: fs.readFileSync(keyPath)
}, app);

const httpServer = http.createServer(app);

const wsServers = [];

function createWsServer(server) {
  const wsServer = new WebSocketServer({ server });
  wsServers.push(wsServer);
  return wsServer;
}

const wssSecure = createWsServer(httpsServer);
const wssInsecure = createWsServer(httpServer);
const nativeConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

function broadcastServerLog(level, message) {
  const payload = JSON.stringify({
    type: "server-log",
    level,
    message,
    ts: Date.now()
  });
  wsServers.forEach((wsServer) => {
    wsServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  });
}

["log", "info", "warn", "error"].forEach((level) => {
  console[level] = (...args) => {
    nativeConsole[level](...args);
    const message = args.map((arg) => {
      if (typeof arg === "string") {
        return arg;
      }
      try {
        return JSON.stringify(arg);
      } catch (_error) {
        return String(arg);
      }
    }).join(" ");
    broadcastServerLog(level, message);
  };
});

function broadcast(data, exceptSocket) {
  wsServers.forEach((wsServer) => {
    wsServer.clients.forEach((client) => {
      if (client !== exceptSocket && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  });
}

function handleWsConnection(socket) {
  console.info("WebSocket conectado.");
  let iceCount = 0;

  socket.on("close", () => {
    console.info("WebSocket desconectado.");
  });

  socket.on("message", (raw, isBinary) => {
    if (isBinary && Buffer.isBuffer(raw)) {
      return;
    }

    const text = raw.toString();
    try {
      const payload = JSON.parse(text);
      if (payload && payload.type && (payload.type.startsWith("webrtc-") || payload.type === "viewer-ready")) {
        if (payload.type === "webrtc-offer" || payload.type === "webrtc-answer") {
          console.info(`Signaling: ${payload.type}.`);
        }
        if (payload.type === "viewer-ready") {
          console.info("Signaling: viewer-ready.");
        }
        if (payload.type === "webrtc-ice") {
          iceCount += 1;
          if (iceCount === 1 || iceCount % 10 === 0) {
            console.info(`Signaling: webrtc-ice (${iceCount}).`);
          }
        }
        broadcast(JSON.stringify(payload), socket);
      }
    } catch (_error) {
      return;
    }
  });
}

wssSecure.on("connection", handleWsConnection);
wssInsecure.on("connection", handleWsConnection);

httpsServer.listen(httpsPort, "0.0.0.0", () => {
  console.log(`HTTPS server listening on port ${httpsPort}`);
});

httpServer.listen(httpPort, "0.0.0.0", () => {
  console.log(`HTTP server listening on port ${httpPort}`);
});
