"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useState } from "react";
import Room from "../components/Room";
import { createClient } from "@supabase/supabase-js";
import * as THREE from "three";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
);

export default function ThirdPersonView() {
  const [viewState, setViewState] = useState({
    position: [0, 0, 0],
    rotation: [0, 0, 0],
  });
  const [fullScreen, setFullScreen] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel("vr-position", {
        config: { broadcast: { ack: true, self: true } },
      })
      .on("broadcast", { event: "viewstate" }, (payload) => {
        try {
          const { position, rotation } = payload.payload;
          if (validateViewState(position, rotation)) {
            setViewState({ position, rotation });
          }
        } catch (error) {
          console.error("Error processing viewstate:", error);
        }
      })
      .subscribe();

    return () => channel.unsubscribe();
  }, []);

  const toggleFullscreen = () => {
    const element = document.documentElement;
    if (!document.fullscreenElement) {
      element.requestFullscreen().catch((err) => {
        console.error(
          `Error attempting to enable fullscreen mode: ${err.message}`
        );
      });
      setFullScreen(true);
    } else {
      document.exitFullscreen().catch((err) => {
        console.error(
          `Error attempting to exit fullscreen mode: ${err.message}`
        );
      });
    }
  };

  return (
    <div
      onClick={toggleFullscreen}
      style={{ width: "100vw", height: "100vh", background: "white" }}
    >
      <Canvas camera={{ position: [6, 6, 6], fov: 30 }}>
        <ambientLight intensity={1.2} />
        <group position={[0, -1, 0]}>
          <Room />
          <ViewCone viewState={viewState} />
        </group>
      </Canvas>
    </div>
  );
}

function validateViewState(position, rotation) {
  return (
    Array.isArray(position) &&
    position.length === 3 &&
    Array.isArray(rotation) &&
    rotation.length === 3 &&
    position.every((n) => typeof n === "number") &&
    rotation.every((n) => typeof n === "number")
  );
}

function ViewCone({ viewState }) {
  const { position, rotation } = viewState;

  // Convert degrees to radians
  const yawRad = THREE.MathUtils.degToRad(rotation[1]); // Only use yaw for body rotation
  const headRotation = new THREE.Euler(
    THREE.MathUtils.degToRad(rotation[0]), // Pitch
    THREE.MathUtils.degToRad(rotation[1]), // Yaw
    THREE.MathUtils.degToRad(rotation[2]), // Roll
    "YXZ" // Use VR rotation order
  );

  return (
    <group position={[position[0], 0.5, position[2]]}>
      {/* Body - only rotates around Y axis (yaw) */}
      <mesh rotation={[0, yawRad, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 1, 32]} />
        <meshStandardMaterial color="#C9CCD3" />
      </mesh>

      {/* Head and view cone - full rotation */}
      <group position={[0, 0.9, 0]} rotation={headRotation}>
        {/* Head */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.3, 32, 32]} />
          <meshStandardMaterial color="#C9CCD3" />
        </mesh>

        {/* View Cone */}
        <mesh position={[0, 0, -1]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.5, 2, 32]} />
          <meshStandardMaterial color="cyan" transparent opacity={0.2} />
        </mesh>
      </group>
    </group>
  );
}
