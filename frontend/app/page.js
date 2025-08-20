"use client";

import { useState, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { XR, createXRStore } from "@react-three/xr";
import { PerspectiveCamera } from "@react-three/drei";
import Room from "./components/Room";
import { VRControls } from "./components/VRControls";
import { createClient } from "@supabase/supabase-js";
import * as THREE from "three";

const xrStore = createXRStore({
  originReferenceSpace: "viewer",
  bounded: true,
});
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
);

const ESP32_WS_URL = "wss://localhost:3001/ws";

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
    const { data, error } = await supabase.rpc("get_random_unviewed_artworks", {
      limit_count: 4,
      source_filter: "Flickr",
      media_type_filter: "image",
    });

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
        .from("artworks")
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
          <GazeRaycaster ws={ws} />
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

function GazeRaycaster({ ws }) {
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
      // Send "looked at" command immediately when starting to look at a canvas
      const target = canvas;
      if (ws.current && ws.current.readyState === 1 && target) {
        ws.current.send(
          JSON.stringify({ target, action: "looked_at", canvas })
        );
      }
    } else if (!canvas && lastCanvasRef.current) {
      // Send "not looked at" command when looking away from a canvas
      const target = lastCanvasRef.current;
      if (ws.current && ws.current.readyState === 1 && target) {
        ws.current.send(
          JSON.stringify({
            target,
            action: "not_looked_at",
            canvas: lastCanvasRef.current,
          })
        );
      }
      lastCanvasRef.current = null;
    }
  });

  return null;
}
