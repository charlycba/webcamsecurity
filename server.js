const fs = require("fs");
const path = require("path");
const https = require("https");
const express = require("express");
const { WebSocketServer } = require("ws");

const app = express();
const port = Number(process.env.PORT || 8443);
const certPath = process.env.CERT_PATH || path.join(__dirname, "certs", "local.crt");
const keyPath = process.env.KEY_PATH || path.join(__dirname, "certs", "local.key");

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error("Missing TLS cert or key. Provide certs/local.crt and certs/local.key.");
  process.exit(1);
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

const server = https.createServer({
  cert: fs.readFileSync(certPath),
  key: fs.readFileSync(keyPath)
}, app);

const wss = new WebSocketServer({ server });
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
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
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
  wss.clients.forEach((client) => {
    if (client !== exceptSocket && client.readyState === client.OPEN) {
      client.send(data);
    }
  });
}

wss.on("connection", (socket) => {
  socket.on("message", (raw, isBinary) => {
    if (isBinary && Buffer.isBuffer(raw)) {
      return;
    }

    const text = raw.toString();
    try {
      const payload = JSON.parse(text);
      if (payload && payload.type && payload.type.startsWith("webrtc-")) {
        broadcast(JSON.stringify(payload), socket);
      }
    } catch (_error) {
      return;
    }
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`HTTPS server listening on port ${port}`);
});
