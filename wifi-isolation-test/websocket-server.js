const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

// Create HTTP server to serve the test page
const server = http.createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(fs.readFileSync(path.join(__dirname, "test.html")));
  } else if (req.url === "/test.js") {
    res.writeHead(200, { "Content-Type": "application/javascript" });
    res.end(fs.readFileSync(path.join(__dirname, "test.js")));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

const clients = new Map();
let clientCounter = 0;

wss.on("connection", (ws, req) => {
  const clientId = ++clientCounter;
  const clientIP = req.socket.remoteAddress;

  console.log(`Client ${clientId} connected from ${clientIP}`);

  clients.set(clientId, {
    ws,
    ip: clientIP,
    connectedAt: new Date(),
  });

  // Send welcome message with client ID
  ws.send(
    JSON.stringify({
      type: "welcome",
      clientId,
      message: `Connected as client ${clientId}`,
      totalClients: clients.size,
    })
  );

  // Broadcast to all clients about new connection
  broadcast(
    {
      type: "client_joined",
      clientId,
      ip: clientIP,
      totalClients: clients.size,
    },
    clientId
  );

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`Message from client ${clientId}:`, data);

      switch (data.type) {
        case "ping":
          ws.send(
            JSON.stringify({
              type: "pong",
              timestamp: Date.now(),
              clientId,
            })
          );
          break;

        case "broadcast":
          broadcast(
            {
              type: "broadcast",
              from: clientId,
              message: data.message,
              timestamp: Date.now(),
            },
            clientId
          );
          break;

        case "direct_message":
          if (data.targetClientId && clients.has(data.targetClientId)) {
            clients.get(data.targetClientId).ws.send(
              JSON.stringify({
                type: "direct_message",
                from: clientId,
                message: data.message,
                timestamp: Date.now(),
              })
            );
          }
          break;

        case "get_clients":
          ws.send(
            JSON.stringify({
              type: "clients_list",
              clients: Array.from(clients.entries()).map(([id, client]) => ({
                id,
                ip: client.ip,
                connectedAt: client.connectedAt,
              })),
            })
          );
          break;
      }
    } catch (error) {
      console.error("Error parsing message:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message format",
        })
      );
    }
  });

  ws.on("close", () => {
    console.log(`Client ${clientId} disconnected`);
    clients.delete(clientId);

    // Broadcast to remaining clients about disconnection
    broadcast({
      type: "client_left",
      clientId,
      totalClients: clients.size,
    });
  });

  ws.on("error", (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
  });
});

function broadcast(message, excludeClientId = null) {
  clients.forEach((client, clientId) => {
    if (
      clientId !== excludeClientId &&
      client.ws.readyState === WebSocket.OPEN
    ) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Wi-Fi Isolation Test Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
  console.log(
    `Or access from other devices on the same network: http://[YOUR_IP]:${PORT}`
  );

  // Get local IP address
  const os = require("os");
  const networkInterfaces = os.networkInterfaces();
  let localIP = "localhost";

  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === "IPv4" && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
    if (localIP !== "localhost") break;
  }

  console.log(`Local IP: ${localIP}`);
  console.log(`Access from other devices: http://${localIP}:${PORT}`);
});
