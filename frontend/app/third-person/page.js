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
        console.log("Received position:", payload.payload);
        setPosition(payload.payload);
      })
      .subscribe();

    return () => channel.unsubscribe();
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
