import express from "express";
import https from "https";
import fs from "fs";
import WebSocket, { WebSocketServer } from "ws";

const app = express();

// Add CORS and security headers for Quest 2 compatibility
app.use((req, res, next) => {
  // CORS headers
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  // Security headers for Quest 2
  res.header("X-Frame-Options", "SAMEORIGIN");
  res.header("X-Content-Type-Options", "nosniff");
  res.header("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content Security Policy for Quest 2
  res.header(
    "Content-Security-Policy",
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-src 'self' https:; worker-src 'self' blob: data:; child-src 'self' blob: data:; object-src 'none'; base-uri 'self';"
  );

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }

  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const options = {
  key: fs.readFileSync("../certificates/vr-museum-key.pem"),
  cert: fs.readFileSync("../certificates/vr-museum.pem"),
};

const server = https.createServer(options, app);

const DEVICE_URLS = {
  // left: "ws://10.10.10.105:81",
  centerLeft: "ws://10.10.10.106:81",
  // centerRight: "ws://10.10.10.107:81",
  // right: "ws://10.10.10.108:81",
};

// const DEVICE_URLS = {
//   // left: "ws://10.10.10.105:81",
//   centerLeft: "ws://167.254.155.106:81",
//   // centerRight: "ws://10.10.10.107:81",
//   // right: "ws://10.10.10.108:81",
// };

const deviceSockets = new Map();

function connectToDevice(name, url) {
  const connect = () => {
    const ws = new WebSocket(url);
    ws.on("open", () => {
      console.log(`Connected to ${name} at ${url}`);
      deviceSockets.set(name, ws);
    });
    ws.on("message", (data) => {
      console.log(`Received from device ${name}:`, data.toString());
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

// Function to route binary LED array data
function routeBinaryData(target, binaryData) {
  const sock = deviceSockets.get(target);
  if (sock && sock.readyState === 1 && sock.send) {
    sock.send(binaryData);
    console.log(`Sent binary data to ${target}: ${binaryData.length} bytes`);
  } else {
    console.log(`Failed to send binary data to ${target}: socket not ready`);
  }
}

// Function to route binary messages based on canvas ID
function routeBinaryMessage(binaryData) {
  const view = new Uint8Array(binaryData);
  const nameLen = view[0];
  const canvasId = Buffer.from(view.slice(1, 1 + nameLen)).toString("utf8");
  const ledData = view.slice(1 + nameLen);

  console.log(
    `Routing binary message for canvas: ${canvasId}, data size: ${ledData.length} bytes`
  );

  // Route to the appropriate device based on canvas ID
  if (deviceSockets.has(canvasId)) {
    routeBinaryData(canvasId, binaryData);
  } else {
    console.log(`No device found for canvas: ${canvasId}`);
  }
}

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  console.log(`New client connected`);

  ws.on("message", (data) => {
    // All messages are now binary
    if (data instanceof Buffer) {
      console.log(`Received binary message: ${data.length} bytes`);
      routeBinaryMessage(data);
    } else {
      console.log(`Received non-binary message, ignoring`);
    }
  });

  ws.on("close", () => {
    console.log(`Client disconnected`);
  });

  ws.on("error", (error) => {
    console.error(`Client WebSocket error:`, error.message);
  });
});

for (const [name, url] of Object.entries(DEVICE_URLS)) {
  connectToDevice(name, url);
}

server.listen(3001, () => {
  console.log("🔐 Hub server running at port 3001");
});
