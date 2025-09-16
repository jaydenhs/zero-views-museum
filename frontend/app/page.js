"use client";

import { useState, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { XR, createXRStore } from "@react-three/xr";
import { PerspectiveCamera } from "@react-three/drei";
import Room from "./components/Room";
import { VRControls } from "./components/VRControls";
import { createClient } from "@supabase/supabase-js";
import GazeRaycaster from "./components/GazeRaycaster";
import { toFlickrSize } from "./lib/flickr";

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

export default function VRView() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const ws = useRef(null);

  const fetchImages = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc(
        "get_unviewed_flickr_images_cc",
        { limit_count: 4 }
      );
      if (error) throw error;

      if (!data || data.length === 0) {
        setImages([]);
        return;
      }

      const imagesWithDimensions = await Promise.all(
        data.map(
          (img) =>
            new Promise((resolve) => {
              const image = new Image();
              // Fetch a smaller variant for quick intrinsic sizing
              image.src = img.url; // 100px
              image.onload = () =>
                resolve({
                  ...img,
                  width: image.width,
                  height: image.height,
                });
            })
        )
      );

      setImages(imagesWithDimensions);

      const viewedIds = data.map((img) => img.id);
      await supabase
        .from("artworks_cc")
        .update({ viewed: true })
        .in("id", viewedIds);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      fetchImages();
    };

    initializeApp();
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
          pointerEvents: "none",
        }}
      >
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
            onClick={() => xrStore.enterVR()}
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
          <button
            onClick={() => fetchImages()}
            style={{
              fontSize: "20px",
              background: "green",
              padding: "1rem",
              border: "none",
              borderRadius: "5px",
              color: "white",
              cursor: "pointer",
            }}
          >
            Fetch Images
          </button>
        </div>
      </div>
    </>
  );
}
