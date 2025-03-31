"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { XR, createXRStore } from "@react-three/xr";
import { Canvas } from "@react-three/fiber";

import Room from "./components/Room";

const xrStore = createXRStore({
  originReferenceSpace: "local-floor",
  bounded: true,
});

const App = () => {
  return (
    <>
      <Canvas
        style={{
          position: "fixed",
          width: "100vw",
          height: "100vh",
        }}
        onCreated={({ camera }) => {
          console.log("Camera position:", camera.position);
        }}
      >
        <color args={["white"]} attach={"background"}></color>
        <PerspectiveCamera makeDefault position={[0, 1.6, 0]} fov={110} />
        <XR store={xrStore}>
          <Room />
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
};

export default App;
