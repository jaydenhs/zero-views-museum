import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useXRInputSourceState } from "@react-three/xr";
import { useFrame } from "@react-three/fiber";
import Photo from "./Photo";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
);

export default function Room() {
  const [images, setImages] = useState([]);

  const fetchImages = async () => {
    const { data, error } = await supabase.rpc("get_random_artworks", {
      limit_count: 4,
      source_filter: "Flickr",
      media_type_filter: "image",
    });

    if (!error) {
      const imagesWithDimensions = await Promise.all(
        data.map(
          (image) =>
            new Promise((resolve) => {
              const img = new Image();
              img.src = image.url;
              img.onload = () =>
                resolve({ ...image, width: img.width, height: img.height });
            })
        )
      );
      setImages(imagesWithDimensions);
    }
  };

  useEffect(() => {
    console.log("Initial useEffect called again");
    fetchImages(); // Load initial images
  }, []);

  return (
    <group>
      {/* Listen for A-button presses */}
      <VRControl reloadImages={() => fetchImages()} />

      {/* Bright Light on Ceiling */}
      <mesh position={[0, 3.5, 0]}>
        <sphereGeometry args={[0.1, 32, 32]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <pointLight position={[0, 3.5, 0]} intensity={40} />

      <mesh position={[0, 4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 4]} />
        <meshStandardMaterial color="white" />
      </mesh>

      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 4]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Walls */}
      {[
        { position: [0, 2, -2], rotation: [0, 0, 0] }, // Front
        { position: [0, 2, 2], rotation: [0, Math.PI, 0] }, // Back
        { position: [-2, 2, 0], rotation: [0, Math.PI / 2, 0] }, // Left
        { position: [2, 2, 0], rotation: [0, -Math.PI / 2, 0] }, // Right
      ].map(({ position, rotation }, i) => (
        <group key={i} position={position} rotation={rotation}>
          <mesh>
            <planeGeometry args={[4, 4]} />
            <meshStandardMaterial color="white" />
          </mesh>
          {images[i] && (
            <Photo key={i} position={[0, -0.4, 0]} image={images[i]} />
          )}
        </group>
      ))}
    </group>
  );
}

function VRControl({ reloadImages }) {
  const controllerRight = useXRInputSourceState("controller", "right");
  const [buttonPressed, setButtonPressed] = useState(false);

  useFrame(() => {
    const isPressed =
      controllerRight?.gamepad?.["a-button"]?.state === "pressed";

    if (isPressed && !buttonPressed) {
      reloadImages();
      setButtonPressed(true);
    } else if (!isPressed && buttonPressed) {
      setButtonPressed(false);
    }
  });

  return null;
}
