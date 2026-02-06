const fs = require("fs");
const path = require("path");
const https = require("https");
const express = require("express");
const { WebSocketServer } = require("ws");

const app = express();
const port = Number(process.env.PORT || 8443);
const certPath = process.env.CERT_PATH || path.join(__dirname, "certs", "local.crt");
const keyPath = process.env.KEY_PATH || path.join(__dirname, "certs", "local.key");
const snapshotsDir = path.join(__dirname, "snapshots");

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error("Missing TLS cert or key. Provide certs/local.crt and certs/local.key.");
  process.exit(1);
}

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.post("/api/snapshot", (req, res) => {
  const { dataUrl } = req.body || {};
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    return res.status(400).json({ ok: false, error: "invalid dataUrl" });
  }
  const base64 = dataUrl.split(",")[1];
  const buffer = Buffer.from(base64, "base64");

  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `snapshot-${timestamp}.jpg`;
  const filePath = path.join(snapshotsDir, fileName);
  const latestPath = path.join(snapshotsDir, "latest.jpg");

  fs.writeFileSync(filePath, buffer);
  fs.writeFileSync(latestPath, buffer);

  return res.json({ ok: true, file: `/snapshots/${fileName}`, latest: "/snapshots/latest.jpg" });
});

app.use("/snapshots", express.static(snapshotsDir));

const server = https.createServer({
  cert: fs.readFileSync(certPath),
  key: fs.readFileSync(keyPath)
}, app);

const wss = new WebSocketServer({ server });
let lastFrameDataUrl = null;
let lastFrameMeta = null;

function normalizeIp(address) {
  if (!address) {
    return "Desconocida";
  }
  if (address.startsWith("::ffff:")) {
    return address.slice(7);
  }
  return address;
}

function broadcast(data, exceptSocket) {
  wss.clients.forEach((client) => {
    if (client !== exceptSocket && client.readyState === client.OPEN) {
      client.send(data);
    }
  });
}

wss.on("connection", (socket) => {
  if (lastFrameDataUrl) {
    socket.send(JSON.stringify({
      type: "frame",
      dataUrl: lastFrameDataUrl,
      meta: lastFrameMeta
    }));
  }

  socket.on("message", (raw) => {
    let dataUrl = null;
    let meta = null;
    const text = raw.toString();

    if (text.startsWith("data:image/")) {
      dataUrl = text;
    } else {
      try {
        const payload = JSON.parse(text);
        if (payload && payload.type === "frame" && typeof payload.dataUrl === "string") {
          dataUrl = payload.dataUrl;
          meta = {
            ip: normalizeIp(socket?._socket?.remoteAddress),
            quality: payload.quality || "Desconocida",
            mode: payload.mode || null
          };
        }
      } catch (_error) {
        return;
      }
    }

    if (!dataUrl) {
      return;
    }

    lastFrameDataUrl = dataUrl;
    if (meta) {
      lastFrameMeta = meta;
    }
    broadcast(JSON.stringify({ type: "frame", dataUrl, meta: lastFrameMeta }), socket);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`HTTPS server listening on port ${port}`);
});
