"use client";

import { useState, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { XR, createXRStore } from "@react-three/xr";
import { PerspectiveCamera } from "@react-three/drei";
import Room from "./components/Room";
import { VRControls } from "./components/VRControls";
import DebugConsole from "./components/DebugConsole";
import { createClient } from "@supabase/supabase-js";
import * as THREE from "three";

// Configuration - Set to true for offline mode
const OFFLINE_MODE = true;
// Use relative URLs to leverage Next.js proxy
const LOCAL_API_URL = ""; // Empty string means relative URLs will be used

// Function to test HTTPS connection (required for WebXR)
const testHttpsConnection = async () => {
  try {
    console.log("Testing HTTPS connection...");
    const response = await fetch(`/api/health`, {
      method: "GET",
      mode: "cors",
      cache: "no-cache",
    });
    if (response.ok) {
      console.log("HTTPS connection successful");
      return true;
    } else {
      console.error(`HTTPS connection failed with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error("HTTPS connection failed:", error.message);
    console.error(
      "This is likely a certificate issue. Quest 2 requires valid HTTPS certificates."
    );
    return false;
  }
};

// Function to check WebXR support and features
const checkWebXRSupport = async () => {
  try {
    if (!navigator.xr) {
      console.error("WebXR is not supported in this browser");
      return { supported: false, reason: "WebXR not available" };
    }

    const immersiveVrSupported = await navigator.xr.isSessionSupported(
      "immersive-vr"
    );
    if (!immersiveVrSupported) {
      console.error("Immersive VR is not supported");
      return { supported: false, reason: "Immersive VR not supported" };
    }

    // Check for dom-overlay support (optional)
    const domOverlaySupported = await navigator.xr.isSessionSupported(
      "immersive-vr",
      {
        optionalFeatures: ["dom-overlay"],
      }
    );

    console.log("WebXR Support Check:");
    console.log("- Immersive VR:", immersiveVrSupported);
    console.log("- DOM Overlay:", domOverlaySupported);

    return {
      supported: true,
      immersiveVr: immersiveVrSupported,
      domOverlay: domOverlaySupported,
    };
  } catch (error) {
    console.error("Error checking WebXR support:", error);
    return { supported: false, reason: error.message };
  }
};

// Global console log capture - starts immediately when page loads
const globalLogs = [];
const maxLogs = 100;
let logIdCounter = 0;

const addGlobalLog = (level, args) => {
  const timestamp = new Date().toLocaleTimeString();
  const message = args
    .map((arg) =>
      typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
    )
    .join(" ");

  const newLog = {
    id: ++logIdCounter,
    timestamp,
    level,
    message,
    time: Date.now(),
  };

  globalLogs.unshift(newLog);
  if (globalLogs.length > maxLogs) {
    globalLogs.splice(maxLogs);
  }

  // Dispatch event to notify components of new log (only in browser)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("newConsoleLog", { detail: newLog }));
  }
};

// Capture console methods immediately (only in browser)
if (typeof window !== "undefined") {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;

  console.log = (...args) => {
    originalLog(...args);
    addGlobalLog("log", args);
  };

  console.error = (...args) => {
    originalError(...args);
    addGlobalLog("error", args);
  };

  console.warn = (...args) => {
    originalWarn(...args);
    addGlobalLog("warn", args);
  };

  console.info = (...args) => {
    originalInfo(...args);
    addGlobalLog("info", args);
  };
}

// Function to process image and create LED array for 30x30 grid
const processImageForLEDStrip = async (imageUrl, width = 30, height = 30) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      // Create canvas to process image
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Calculate crop dimensions to maintain aspect ratio
      const imgAspectRatio = img.width / img.height;
      const targetAspectRatio = width / height;

      let sourceX, sourceY, sourceWidth, sourceHeight;

      if (imgAspectRatio > targetAspectRatio) {
        // Image is wider than target - crop from center
        sourceHeight = img.height;
        sourceWidth = img.height * targetAspectRatio;
        sourceX = (img.width - sourceWidth) / 2;
        sourceY = 0;
      } else {
        // Image is taller than target - crop from center
        sourceWidth = img.width;
        sourceHeight = img.width / targetAspectRatio;
        sourceX = 0;
        sourceY = (img.height - sourceHeight) / 2;
      }

      // Set canvas size to target LED grid size
      canvas.width = width;
      canvas.height = height;

      // Draw cropped and resized image to canvas
      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight, // Source rectangle (cropped)
        0,
        0,
        width,
        height // Destination rectangle (target size)
      );

      // Get image data
      const imageData = ctx.getImageData(0, 0, width, height);
      const pixels = imageData.data;

      // Increase saturation of the image
      // Helper: convert RGB to HSL and back
      function rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b),
          min = Math.min(r, g, b);
        let h,
          s,
          l = (max + min) / 2;

        if (max === min) {
          h = s = 0; // achromatic
        } else {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r:
              h = (g - b) / d + (g < b ? 6 : 0);
              break;
            case g:
              h = (b - r) / d + 2;
              break;
            case b:
              h = (r - g) / d + 4;
              break;
          }
          h /= 6;
        }
        return [h, s, l];
      }

      function hslToRgb(h, s, l) {
        let r, g, b;

        if (s === 0) {
          r = g = b = l; // achromatic
        } else {
          function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
          }
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          r = hue2rgb(p, q, h + 1 / 3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1 / 3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
      }

      // Set the saturation boost factor (e.g., 1.5 = 50% more saturated)
      const SATURATION_BOOST = 1.5;

      // Create LED array with serpentine pattern
      const ledArray = [];
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          // Serpentine pattern: reverse every other row
          const actualX = y % 2 === 1 ? width - 1 - x : x;
          const pixelIndex = (y * width + actualX) * 4;

          // Extract RGB values (skip alpha)
          let r = pixels[pixelIndex];
          let g = pixels[pixelIndex + 1];
          let b = pixels[pixelIndex + 2];

          // Convert to HSL, boost saturation, clamp to [0,1], convert back to RGB
          let [h, s, l] = rgbToHsl(r, g, b);
          s = Math.min(s * SATURATION_BOOST, 1);
          [r, g, b] = hslToRgb(h, s, l);

          ledArray.push(r, g, b);
        }
      }

      resolve(ledArray);
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image: ${imageUrl}`));
    };

    img.src = imageUrl;
  });
};

const xrStore = createXRStore({
  originReferenceSpace: "viewer",
  bounded: true,
  emulate: {
    inject: true,
  },
  // Configure WebXR session to avoid dom-overlay issues on Quest 2
  sessionInit: {
    optionalFeatures: [],
    requiredFeatures: [],
    // Explicitly avoid requesting dom-overlay which is not supported in immersive-vr mode on Quest 2
  },
});

// Initialize Supabase client (only used in online mode)
const supabase = OFFLINE_MODE
  ? null
  : createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_KEY
    );

// Dynamic WebSocket URL that works for both localhost and network access
const getWebSocketURL = () => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  const port = "3001";
  return `${protocol}//${host}:${port}/ws`;
};

const ESP32_WS_URL =
  typeof window !== "undefined" ? getWebSocketURL() : "ws://localhost:3001/ws";

// API functions for different modes
const api = {
  // Fetch unviewed images
  async fetchUnviewedImages() {
    if (OFFLINE_MODE) {
      // Test HTTPS connection first
      const isHttpsWorking = await testHttpsConnection();
      if (!isHttpsWorking) {
        throw new Error(
          "HTTPS connection failed. Quest 2 requires valid SSL certificates."
        );
      }

      // Use local API
      console.log(`Making request to: /api/artworks/unviewed?limit=4`);
      try {
        const response = await fetch(`/api/artworks/unviewed?limit=4`);
        console.log(`Response status: ${response.status}`);
        console.log(
          `Response headers:`,
          Object.fromEntries(response.headers.entries())
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API Error Response:`, errorText);
          throw new Error(`Local API error: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        console.log(`Received data:`, data);
        return data;
      } catch (error) {
        console.error(`Fetch error details:`, error);
        throw error;
      }
    } else {
      // Use Supabase
      const { data, error } = await supabase.rpc(
        "get_unviewed_flickr_images_cc",
        {
          limit_count: 4,
        }
      );
      if (error) throw error;
      return data;
    }
  },

  // Mark images as viewed
  async markAsViewed(imageIds) {
    if (OFFLINE_MODE) {
      // Use local API
      const response = await fetch(`/api/artworks/view`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: imageIds }),
      });
      if (!response.ok) {
        throw new Error(`Local API error: ${response.status}`);
      }
      return await response.json();
    } else {
      // Use Supabase
      const { error } = await supabase
        .from("artworks_cc")
        .update({ viewed: true })
        .in("id", imageIds);
      if (error) throw error;
      return { success: true };
    }
  },

  // Get API status
  async getStatus() {
    if (OFFLINE_MODE) {
      console.log(`Making health check request to: /api/health`);
      try {
        const response = await fetch(`/api/health`);
        console.log(`Health check response status: ${response.status}`);
        const data = await response.json();
        console.log(`Health check data:`, data);
        return data;
      } catch (error) {
        console.error(`Health check error:`, error);
        throw error;
      }
    } else {
      return { status: "online", service: "Supabase" };
    }
  },
};

export default function VRView() {
  const [images, setImages] = useState([]);
  const [apiStatus, setApiStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chunkError, setChunkError] = useState(null);
  const [debugConsoleVisible, setDebugConsoleVisible] = useState(true);
  const [debugLogs, setDebugLogs] = useState([]);
  const ws = useRef(null);

  // Listen for new console logs
  useEffect(() => {
    const handleNewLog = () => {
      setDebugLogs([...globalLogs]);
    };

    // Only run on client side
    if (typeof window !== "undefined") {
      // Load existing logs after hydration
      setDebugLogs([...globalLogs]);

      window.addEventListener("newConsoleLog", handleNewLog);
      return () => window.removeEventListener("newConsoleLog", handleNewLog);
    }
  }, []);

  useEffect(() => {
    let reconnectTimeout;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;
    const reconnectDelay = 2000; // 2 seconds

    const connectWebSocket = () => {
      try {
        ws.current = new window.WebSocket(ESP32_WS_URL);

        ws.current.onopen = () => {
          console.log("WebSocket connected to ESP32");
          reconnectAttempts = 0; // Reset on successful connection
        };

        ws.current.onclose = (event) => {
          console.log(
            "WebSocket disconnected from ESP32",
            event.code,
            event.reason
          );

          // Attempt to reconnect if not a normal closure
          if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(
              `Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts}) in ${reconnectDelay}ms...`
            );
            reconnectTimeout = setTimeout(connectWebSocket, reconnectDelay);
          } else if (reconnectAttempts >= maxReconnectAttempts) {
            console.error(
              "Max reconnection attempts reached. WebSocket connection failed."
            );
          }
        };

        ws.current.onerror = (error) => {
          console.error("WebSocket error:", error);
          // Don't log empty error objects
          if (error && Object.keys(error).length > 0) {
            console.error("WebSocket error details:", error);
          }
        };

        ws.current.onmessage = (event) => {
          console.log("Received message:", event.data);
        };
      } catch (error) {
        console.error("Failed to create WebSocket connection:", error);
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          console.log(
            `Retrying WebSocket connection (${reconnectAttempts}/${maxReconnectAttempts}) in ${reconnectDelay}ms...`
          );
          reconnectTimeout = setTimeout(connectWebSocket, reconnectDelay);
        }
      }
    };

    // connectWebSocket();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws.current) {
        ws.current.close(1000, "Component unmounting");
      }
    };
  }, []);

  const fetchImages = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log(
        `Fetching images in ${OFFLINE_MODE ? "offline" : "online"} mode...`
      );
      console.log(`API URL: /api (proxied to Flask server)`);

      const data = await api.fetchUnviewedImages();

      if (!data || data.length === 0) {
        console.log("No unviewed images found");
        setImages([]);
        return;
      }

      // Get image dimensions for each image
      const imagesWithDimensions = await Promise.all(
        data.map(
          (img) =>
            new Promise((resolve) => {
              const image = new Image();
              image.src = img.url;
              image.onload = () =>
                resolve({
                  ...img,
                  width: image.width,
                  height: image.height,
                });
              image.onerror = () => {
                console.warn(`Failed to load image: ${img.url}`);
                resolve({
                  ...img,
                  width: 1920,
                  height: 1080,
                });
              };
            })
        )
      );

      setImages(imagesWithDimensions);

      // Mark images as viewed
      const viewedIds = data.map((img) => img.id);
      // await api.markAsViewed(viewedIds);
      console.log(`Marked ${viewedIds.length} images as viewed`);
    } catch (err) {
      console.error("Error fetching images:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkApiStatus = async () => {
    try {
      const status = await api.getStatus();
      setApiStatus(status);
    } catch (err) {
      console.error("Error checking API status:", err);
      setApiStatus({ status: "error", error: err.message });
    }
  };

  const testApiConnection = async () => {
    console.log("🧪 Manual API Test Started");
    console.log("=".repeat(50));

    try {
      // Test 1: Health check
      console.log("1️⃣ Testing health endpoint...");
      const healthResponse = await fetch(`/api/health`);
      console.log(`   Status: ${healthResponse.status}`);
      const healthData = await healthResponse.json();
      console.log("   Response:", healthData);

      // Test 2: Images endpoint
      console.log("2️⃣ Testing images endpoint...");
      const imagesResponse = await fetch(`/api/artworks/unviewed?limit=4`);
      console.log(`   Status: ${imagesResponse.status}`);
      const imagesData = await imagesResponse.json();
      console.log("   Response:", imagesData);

      // Test 3: API status function
      console.log("3️⃣ Testing API status function...");
      const apiStatus = await api.getStatus();
      console.log("   API Status:", apiStatus);

      console.log("✅ All API tests completed successfully!");
    } catch (error) {
      console.error("❌ API test failed:", error);
      console.error("   Error details:", error.message);
      console.error("   Stack trace:", error.stack);
    }

    console.log("=".repeat(50));
    console.log("🧪 Manual API Test Completed");
  };

  useEffect(() => {
    // Add global error handler for chunk loading failures
    const handleChunkError = (event) => {
      if (event.reason && event.reason.name === "ChunkLoadError") {
        console.error("Chunk load error:", event.reason);
        setChunkError(
          "Failed to load application resources. Please refresh the page."
        );
      }
    };

    // Handle debug console close event
    const handleCloseDebugConsole = () => {
      setDebugConsoleVisible(false);
    };

    // Handle keyboard shortcut for debug console
    const handleKeyPress = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === "D") {
        setDebugConsoleVisible((prev) => !prev);
      }
    };

    // window.addEventListener("unhandledrejection", handleChunkError);
    window.addEventListener("closeDebugConsole", handleCloseDebugConsole);
    window.addEventListener("keydown", handleKeyPress);

    // Test HTTPS connection first, then proceed with API calls
    const initializeApp = async () => {
      console.log("Initializing VR Museum App...");
      console.log(`Target API URL: /api (proxied to Flask server)`);

      // Check WebXR support first
      const webxrSupport = await checkWebXRSupport();
      if (!webxrSupport.supported) {
        setError(`WebXR not supported: ${webxrSupport.reason}`);
        setLoading(false);
        return;
      }

      if (OFFLINE_MODE) {
        const isHttpsWorking = await testHttpsConnection();
        if (!isHttpsWorking) {
          setError(
            "HTTPS connection failed. Quest 2 requires valid SSL certificates. Please check your certificate configuration."
          );
          setLoading(false);
          return;
        }
      }

      checkApiStatus();
      fetchImages();
    };

    initializeApp();

    return () => {
      window.removeEventListener("unhandledrejection", handleChunkError);
      window.removeEventListener("closeDebugConsole", handleCloseDebugConsole);
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, []);

  return (
    <>
      <Canvas style={{ position: "fixed", width: "100vw", height: "100vh" }}>
        <color args={["white"]} attach="background" />
        <PerspectiveCamera makeDefault position={[0, 1.6, 0]} fov={110} />
        <XR store={xrStore}>
          <Room images={images} />
          <VRControls onReload={fetchImages} />
          <GazeRaycaster ws={ws} images={images} />
        </XR>
      </Canvas>

      {/* Debug Console */}
      {debugConsoleVisible && (
        <DebugConsole
          ws={ws}
          apiStatus={apiStatus}
          images={images}
          loading={loading}
          error={error}
          chunkError={chunkError}
          offlineMode={OFFLINE_MODE}
          logs={debugLogs}
          onClearLogs={() => {
            globalLogs.length = 0;
            setDebugLogs([]);
          }}
          onTestApi={testApiConnection}
        />
      )}

      {/* Status and controls overlay */}
      <div
        style={{
          position: "fixed",
          display: "flex",
          width: "100vw",
          height: "100vh",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          color: "white",
          pointerEvents: "none", // Allow clicks to pass through
        }}
      >
        {/* Debug Console Toggle Button */}
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            pointerEvents: "auto",
          }}
        >
          <button
            onClick={() => setDebugConsoleVisible(!debugConsoleVisible)}
            style={{
              background: "rgba(0, 0, 0, 0.8)",
              color: "white",
              border: "2px solid #007acc",
              borderRadius: "50%",
              width: "50px",
              height: "50px",
              fontSize: "20px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Toggle Debug Console (Ctrl+Shift+D)"
          >
            🐛
          </button>
        </div>

        {/* Bottom controls */}
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "10px",
            pointerEvents: "auto",
          }}
        >
          <button
            onClick={async () => {
              try {
                console.log("Attempting to enter VR...");
                await xrStore.enterVR();
                console.log("Successfully entered VR");
              } catch (error) {
                console.error("Failed to enter VR:", error);
                if (error.name === "NotSupportedError") {
                  setError(
                    "VR session not supported. This may be due to dom-overlay feature incompatibility with your headset."
                  );
                } else if (error.name === "SecurityError") {
                  setError(
                    "VR access denied. Please ensure you're using HTTPS and grant permission when prompted."
                  );
                } else {
                  setError(`VR Error: ${error.message}`);
                }
              }
            }}
            style={{
              fontSize: "20px",
              background: "blue",
              padding: "1rem",
              border: "none",
              borderRadius: "5px",
              color: "white",
              cursor: "pointer",
            }}
          >
            Enter VR
          </button>
        </div>
      </div>
    </>
  );
}

function GazeRaycaster({ ws, images }) {
  const { camera, scene } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());
  const lastCanvasRef = useRef(null);
  const lastSentAtRef = useRef(0);

  useFrame(({ clock }) => {
    if (!camera || !scene) return;

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);

    const raycaster = raycasterRef.current;
    raycaster.set(camera.position.clone(), dir);

    const intersects = raycaster.intersectObjects(scene.children, true);

    let canvas = null;
    for (const it of intersects) {
      let obj = it.object;
      while (obj) {
        if (obj.userData && obj.userData.canvas) {
          canvas = obj.userData.canvas;
          break;
        }
        obj = obj.parent;
      }
      if (canvas) break;
    }

    if (canvas && canvas !== lastCanvasRef.current) {
      lastCanvasRef.current = canvas;
      // Send "looked at" command with LED array data when starting to look at a canvas
      const target = canvas;
      if (ws.current && ws.current.readyState === WebSocket.OPEN && target) {
        // Find the image data for this canvas based on canvas position
        let imageData = null;
        if (canvas === "centerLeft" && images[1]) {
          imageData = images[1];
        } else if (canvas === "centerRight" && images[2]) {
          imageData = images[2];
        } else if (canvas === "left" && images[0]) {
          imageData = images[0];
        } else if (canvas === "right" && images[3]) {
          imageData = images[3];
        }

        if (imageData) {
          console.log(`Found image data for ${canvas}:`, imageData);
          // Process the image and create LED array
          processImageForLEDStrip(imageData.url)
            .then((ledArray) => {
              console.log(
                `Created LED array for ${canvas}:`,
                ledArray.length,
                "values"
              );

              // Create binary message: [canvas_id][led_array_data]
              const canvasId = canvas;
              const canvasBytes = new TextEncoder().encode(canvasId);
              const ledBytes = new Uint8Array(ledArray);

              // Length-prefixed header: [length][canvas_id][led_data]
              const header = new Uint8Array([canvasBytes.length]);
              const combinedMessage = new Uint8Array(
                1 + canvasBytes.length + ledBytes.length
              );

              combinedMessage.set(header, 0);
              combinedMessage.set(canvasBytes, 1);
              combinedMessage.set(ledBytes, 1 + canvasBytes.length);

              // Send as single binary message
              ws.current.send(combinedMessage);
            })
            .catch((error) => {
              console.error("Error processing image:", error);
            });
        } else {
          // Fallback if no image data found
          console.log(`No image data found for canvas: ${canvas}`);
          console.log(`Available images:`, images);
          const payload = {
            target,
            action: "looked_at",
            canvas,
            ledArray: null,
          };
          ws.current.send(JSON.stringify(payload));
        }
      }
    } else if (!canvas && lastCanvasRef.current) {
      // Send "not looked at" command when looking away from a canvas
      const target = lastCanvasRef.current;
      if (ws.current && ws.current.readyState === WebSocket.OPEN && target) {
        // Send binary message: [canvas_id][0] (0 indicates clear)
        const canvasId = target;
        const canvasBytes = new TextEncoder().encode(canvasId);
        const clearCommand = new Uint8Array([0]); // 0 = clear

        // Length-prefixed header: [length][canvas_id][clear_command]
        const header = new Uint8Array([canvasBytes.length]);
        const combinedMessage = new Uint8Array(1 + canvasBytes.length + 1);

        combinedMessage.set(header, 0);
        combinedMessage.set(canvasBytes, 1);
        combinedMessage.set(clearCommand, 1 + canvasBytes.length);

        ws.current.send(combinedMessage);
      }
      lastCanvasRef.current = null;
    }
  });

  return null;
}
