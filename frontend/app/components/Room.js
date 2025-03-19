import { useEffect, useState } from "react";
import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import { createClient } from "@supabase/supabase-js";
import * as THREE from "three";
import Photo from "./Photo"; // Your component for displaying images

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
);

export default function Room() {
  const [images, setImages] = useState([]);

  useEffect(() => {
    async function fetchImages() {
      console.log("Fetching images");
      const { data, error } = await supabase
        .from("artworks")
        .select("url, title, creator_name, description, created_at")
        .eq("source", "Flickr")
        .eq("media_type", "image")
        .limit(4);

      if (!error) {
        // Fetching image dimensions after getting the metadata
        const imagesWithDimensions = await Promise.all(
          data.map(async (image) => {
            const img = new Image();
            img.src = image.url;

            return new Promise((resolve) => {
              img.onload = () => {
                resolve({
                  ...image,
                  width: img.width,
                  height: img.height,
                });
              };
            });
          })
        );
        setImages(imagesWithDimensions);
      }
    }

    fetchImages();
  }, []);

  return (
    <group>
      {/* Bright Light on Ceiling */}
      <mesh position={[0, 3.5, 0]}>
        <sphereGeometry args={[0.1, 32, 32]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <pointLight position={[0, 3.5, 0]} intensity={20} />

      <mesh position={[0, 4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 4]} />
        <meshStandardMaterial color="white" />
      </mesh>

      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 4]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Define Walls Separately */}
      {[
        { position: [0, 0, -2], rotationY: [0, 0, 0] }, // Front
        { position: [0, 0, 2], rotation: [0, Math.PI, 0] }, // Back
        { position: [-2, 0, 0], rotation: [0, Math.PI / 2, 0] }, // Left
        { position: [2, 0, 0], rotation: [0, -Math.PI / 2, 0] }, // Right
      ].map(({ position, rotation }, i) => (
        <group
          key={i}
          position={[position[0], 2, position[2]]}
          rotation={rotation}
        >
          <mesh>
            <planeGeometry args={[4, 4]} />
            <meshStandardMaterial color="white" />
          </mesh>
          {images[i] && (
            <Photo
              key={i}
              position={[0, 0, 0.2]} // Slightly forward to avoid z-fighting
              image={images[i]} // Pass the entire image object
            />
          )}
        </group>
      ))}
    </group>
  );
}
