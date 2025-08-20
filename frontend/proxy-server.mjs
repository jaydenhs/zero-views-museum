import express from "express";
import https from "https";
import fs from "fs";
import WebSocket, { WebSocketServer } from "ws";

const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const options = {
  key: fs.readFileSync("certificates/localhost-key.pem"),
  cert: fs.readFileSync("certificates/localhost.pem"),
};

const server = https.createServer(options, app);

const DEVICE_URLS = {
  esp1: "ws://192.168.2.105:81",
  // esp2: "ws://10.120.5.57:81",
  //   esp3: "ws://[IP]:81",
  //   esp4: "ws://[IP]:81",
};

const deviceSockets = new Map();

function connectToDevice(name, url) {
  const connect = () => {
    const ws = new WebSocket(url);
    ws.on("open", () => {
      console.log(`Connected to ${name} at ${url}`);
      deviceSockets.set(name, ws);
    });
    ws.on("message", (data) => {
      broadcastToClients({
        type: "deviceMessage",
        from: name,
        data: data.toString(),
      });
    });
    ws.on("close", () => {
      console.log(`Disconnected from ${name}, retrying in 2s...`);
      deviceSockets.delete(name);
      setTimeout(connect, 2000);
    });
    ws.on("error", (err) => {
      console.log(`Error on ${name}:`, err.message);
    });
  };
  connect();
}

const clients = new Set();

function broadcastToClients(message) {
  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === 1) client.send(payload);
  }
}

function routeClientCommand(command) {
  if (!command) return;
  const { target, ...devicePayload } = command;
  console.log(`Routing command to ${target}:`, devicePayload);
  const sock = deviceSockets.get(target);
  if (sock && sock.readyState === 1 && sock.send) {
    sock.send(JSON.stringify(devicePayload));
    console.log(`Sent to ${target}:`, JSON.stringify(devicePayload));
  } else {
    console.log(`Failed to send to ${target}: socket not ready`);
  }
}

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    routeClientCommand(msg);
  });
  ws.on("close", () => clients.delete(ws));
});

for (const [name, url] of Object.entries(DEVICE_URLS)) {
  connectToDevice(name, url);
}

server.listen(3001, () => {
  console.log("🔐 Hub server running at https://localhost:3001");
});
