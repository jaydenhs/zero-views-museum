"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useState } from "react";
import Room from "../components/Room";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
);

export default function ThirdPersonView() {
  const [position, setPosition] = useState([0, 0, 0]);

  useEffect(() => {
    const channel = supabase
      .channel("vr-position", {
        config: { broadcast: { ack: true, self: true } },
      })
      .on("broadcast", { event: "position" }, (payload) => {
        try {
          const currentTime = new Date().toLocaleTimeString("en-US", {
            hour12: false,
          });
          console.log(`[${currentTime}] Received position:`, payload.payload);
          if (
            Array.isArray(payload.payload) &&
            payload.payload.length === 3 &&
            payload.payload.every((num) => typeof num === "number")
          ) {
            setPosition(payload.payload);
          } else {
            console.error("Invalid position data received:", payload.payload);
          }
        } catch (error) {
          console.error("Error processing position payload:", error);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("Successfully subscribed to vr-position channel");
        } else {
          console.error("Failed to subscribe to vr-position channel:", status);
        }
      });

    return () => {
      channel.unsubscribe().catch((error) => {
        console.error("Error unsubscribing from vr-position channel:", error);
      });
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <Room />
        <mesh position={position}>
          <cylinderGeometry args={[0.5, 0.5, 4.0, 32]} />
          <meshStandardMaterial color="red" />
        </mesh>
        <OrbitControls />
      </Canvas>
    </div>
  );
}
