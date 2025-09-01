"use client";

import { useState, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { XR, createXRStore } from "@react-three/xr";
import { PerspectiveCamera } from "@react-three/drei";
import Room from "./components/Room";
import { VRControls } from "./components/VRControls";
import { createClient } from "@supabase/supabase-js";
import * as THREE from "three";

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
});
const supabase = createClient(
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

// Offline mode flag - set to true to use local images
const OFFLINE_MODE = false;

export default function VRView() {
  const [images, setImages] = useState([]);
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new window.WebSocket(ESP32_WS_URL);
    ws.current.onopen = () => console.log("WebSocket connected to ESP32");
    ws.current.onclose = () => console.log("WebSocket disconnected from ESP32");
    ws.current.onerror = (e) => console.error("WebSocket error", e);
    ws.current.onmessage = (event) =>
      console.log("Received message:", event.data);
    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  const fetchImages = async () => {
    if (OFFLINE_MODE) {
      // Load local offline images
      const offlineImages = [
        {
          id: "offline-1",
          url: "/offline-images/1.avif",
          creator_name: "Offline Artist 1",
          title: "Offline Artwork 1",
          created_at: "2024-01-01",
          width: 1920,
          height: 1080,
        },
        {
          id: "offline-2",
          url: "/offline-images/2.avif",
          creator_name: "Offline Artist 2",
          title: "Offline Artwork 2",
          created_at: "2024-01-02",
          width: 1920,
          height: 1080,
        },
        {
          id: "offline-3",
          url: "/offline-images/3.jpg",
          creator_name: "Offline Artist 3",
          title: "Offline Artwork 3",
          created_at: "2024-01-03",
          width: 1920,
          height: 1080,
        },
        {
          id: "offline-4",
          url: "/offline-images/4.jpg",
          creator_name: "Offline Artist 4",
          title: "Offline Artwork 4",
          created_at: "2024-01-04",
          width: 1920,
          height: 1080,
        },
      ];

      console.log("Offline mode: Loading local images");
      setImages(offlineImages);
      return;
    }

    // Online mode: fetch from Supabase
    const { data, error } = await supabase.rpc(
      "get_unviewed_flickr_images_cc",
      {
        limit_count: 4,
      }
    );

    if (!error) {
      const imagesWithDimensions = await Promise.all(
        data.map(
          (img) =>
            new Promise((resolve) => {
              const image = new Image();
              image.src = img.url;
              image.onload = () =>
                resolve({ ...img, width: image.width, height: image.height });
            })
        )
      );
      setImages(imagesWithDimensions);

      const viewedIds = data.map((img) => img.id);
      await supabase
        .from("artworks_cc")
        .update({ viewed: true })
        .in("id", viewedIds);
    }
  };

  useEffect(() => {
    fetchImages();
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
        }}
      >
        <button
          onClick={() => xrStore.enterVR()}
          style={{
            position: "fixed",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "20px",
            background: "blue",
            padding: "1rem",
          }}
        >
          Enter VR
        </button>
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
      if (ws.current && ws.current.readyState === 1 && target) {
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
      if (ws.current && ws.current.readyState === 1 && target) {
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
