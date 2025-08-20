"use client";

import { useState, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { XR, createXRStore } from "@react-three/xr";
import { PerspectiveCamera, OrbitControls } from "@react-three/drei";
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
  const [cameraPosition, setCameraPosition] = useState([0, 2, 0]);
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
        <OrbitControls
          target={[0, 1.6, 0]}
          enablePan={false}
          minDistance={2}
          maxDistance={10}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI - Math.PI / 6}
        />
        <XR store={xrStore}>
          <Room images={images} />
          <VRControls onReload={fetchImages} />
          <PositionBroadcaster setPosition={setCameraPosition} />
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
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            display: "flex",
            flexDirection: "row",
            gap: "1rem",
            alignItems: "center",
          }}
        >
          <button
            onClick={() => {
              console.log(
                "Button clicked! WebSocket state:",
                ws.current?.readyState
              );
              if (ws.current && ws.current.readyState === 1) {
                const message = { target: "esp1", action: "pulse" };
                console.log("Sending message:", message);
                ws.current.send(JSON.stringify(message));
              } else {
                console.log(
                  "WebSocket not ready. State:",
                  ws.current?.readyState
                );
              }
            }}
            style={{
              fontSize: "20px",
              background: "green",
              padding: "1rem",
            }}
          >
            LED Board 1
          </button>
          <button
            onClick={() => {
              if (ws.current && ws.current.readyState === 1) {
                ws.current.send(
                  JSON.stringify({ target: "esp2", action: "pulse" })
                );
              }
            }}
            style={{
              fontSize: "20px",
              background: "green",
              padding: "1rem",
            }}
          >
            LED Board 2
          </button>
        </div>
      </div>
    </>
  );
}

function PositionBroadcaster({ setPosition }) {
  const { camera } = useThree();
  const [channel, setChannel] = useState(null);
  const [lastBroadcast, setLastBroadcast] = useState(0);

  useEffect(() => {
    const newChannel = supabase
      .channel("vr-position", {
        config: { broadcast: { ack: true, self: true } },
      })
      .subscribe();
    setChannel(newChannel);
    return () => newChannel.unsubscribe();
  }, []);

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    if (camera && channel && now - lastBroadcast >= 1 / 10) {
      // 10 updates/sec
      // Get camera orientation as Euler angles
      const euler = new THREE.Euler().setFromQuaternion(
        camera.quaternion,
        "YXZ" // VR typically uses Y-X-Z rotation order
      );

      const payload = {
        position: [camera.position.x, 0, camera.position.z],
        rotation: [
          THREE.MathUtils.radToDeg(euler.x), // Pitch
          THREE.MathUtils.radToDeg(euler.y), // Yaw
          THREE.MathUtils.radToDeg(euler.z), // Roll
        ],
      };

      setPosition(payload.position);
      channel.send({
        type: "broadcast",
        event: "viewstate",
        payload,
      });
      setLastBroadcast(now);
    }
  });

  return null;
}
