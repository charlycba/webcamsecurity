const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const express = require("express");
const { WebSocketServer, WebSocket } = require("ws");

const app = express();
const httpsPort = Number(process.env.PORT || 8443);
const httpPort = Number(process.env.HTTP_PORT || 8080);
const certPath = process.env.CERT_PATH || path.join(__dirname, "certs", "local.crt");
const keyPath = process.env.KEY_PATH || path.join(__dirname, "certs", "local.key");

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
      if (payload && payload.type && payload.type.startsWith("webrtc-")) {
        if (payload.type === "webrtc-offer" || payload.type === "webrtc-answer") {
          console.info(`Signaling: ${payload.type}.`);
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
