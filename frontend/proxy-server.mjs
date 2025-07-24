import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import https from "https";
import fs from "fs";

// Create the express app
const app = express();

// WebSocket proxy route
app.use(
  "/ws",
  createProxyMiddleware({
    target: "ws://10.120.6.105:81",
    ws: true,
    changeOrigin: true,
    secure: false,
    pathRewrite: { "^/ws": "/" },
  })
);

// HTTPS server options (use mkcert or other self-signed certs)
const options = {
  key: fs.readFileSync("certificates/localhost-key.pem"),
  cert: fs.readFileSync("certificates/localhost.pem"),
};

// Start the HTTPS server
https.createServer(options, app).listen(3001, () => {
  console.log("🔐 Proxy server running at https://localhost:3001");
});
