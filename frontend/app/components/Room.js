import { useLoader } from "@react-three/fiber";
import { useMemo } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import Photo from "./Photo";

export default function Room({ images }) {
  const floorSrc = useMemo(() => {
    // Pick best supported compressed texture (AVIF > WebP > JPG)
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      try {
        const avif = canvas.toDataURL("image/avif");
        if (avif && avif.indexOf("data:image/avif") === 0)
          return "/wood-floor.avif";
      } catch {}
      try {
        const webp = canvas.toDataURL("image/webp");
        if (webp && webp.indexOf("data:image/webp") === 0)
          return "/wood-floor.webp";
      } catch {}
    }
    return "/wood-floor.jpg";
  }, []);

  console.log("Using floor texture:", floorSrc);

  const floorTexture = useLoader(THREE.TextureLoader, floorSrc);
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(4, 4);
  floorTexture.colorSpace = THREE.SRGBColorSpace;
  floorTexture.anisotropy = 8;
  floorTexture.generateMipmaps = true;
  floorTexture.minFilter = THREE.LinearMipmapLinearFilter;

  // Room dimensions: width (x) = 8, depth (z) = 4, height (y) = 4
  const roomWidth = 8;
  const roomDepth = 4;
  const roomHeight = 4;
  const wallTextWidth = 3;

  const lightsX = [-2, 0, 2];

  return (
    <group>
      {/* Bright Lights on Ceiling */}
      {lightsX.map((x, i) => (
        <group key={i} position={[x, 3, 0]}>
          {/* Glowing sphere to look like it's emitting light */}
          <mesh>
            <sphereGeometry args={[0.1, 32, 32]} />
            <meshStandardMaterial
              color="white"
              emissive="white"
              emissiveIntensity={2}
              metalness={0.2}
              roughness={0.3}
            />
          </mesh>
          <pointLight intensity={25} />
        </group>
      ))}

      {/* Ceiling */}
      <mesh position={[0, roomHeight, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[roomWidth, roomDepth]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Floor */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[roomWidth, roomDepth]} />
        <meshStandardMaterial map={floorTexture} />
      </mesh>

      {/* Front Wall (long) */}
      <group
        position={[0, roomHeight / 2, -roomDepth / 2]}
        rotation={[0, 0, 0]}
      >
        <mesh>
          <planeGeometry args={[roomWidth, roomHeight]} />
          <meshStandardMaterial color="white" />
        </mesh>
        {/* Two photos on the front wall */}
        {images?.[1] && (
          <Photo
            position={[-1.5, -0.4, 0]}
            image={images[1]}
            canvas="centerLeft"
          />
        )}
        {images?.[2] && (
          <Photo
            position={[1.5, -0.4, 0]}
            image={images[2]}
            canvas="centerRight"
          />
        )}
      </group>

      {/* Back Wall (long) - no photos */}
      <group
        position={[0, roomHeight / 2, roomDepth / 2]}
        rotation={[0, Math.PI, 0]}
      >
        <mesh>
          <planeGeometry args={[roomWidth, roomHeight]} />
          <meshStandardMaterial color="white" />
        </mesh>
        {/* Wall Text Description */}
        <group position={[-wallTextWidth / 2, 0.2, 0.01]}>
          <Text
            font="/fonts/Libre_Franklin/static/LibreFranklin-Bold.ttf"
            fontSize={0.2}
            color="black"
            anchorX="left"
            anchorY="top"
            textAlign="left"
            maxWidth={wallTextWidth}
          >
            {`Zero Views Museum`}
          </Text>
          <Text
            position={[0, -0.275, 0]}
            font="/fonts/Libre_Franklin/static/LibreFranklin-Bold.ttf"
            fontSize={0.07}
            color="gray"
            anchorX="left"
            anchorY="top"
            textAlign="left"
            maxWidth={wallTextWidth}
          >
            {`Jayden Hsiao, Shaan Sawrup, Selina Ding, Aaron Dyck`}
          </Text>
          <Text
            position={[0, -0.45, 0]}
            font="/fonts/Libre_Franklin/static/LibreFranklin-Regular.ttf"
            fontSize={0.07}
            lineHeight={1.35}
            color="black"
            anchorX="left"
            anchorY="top"
            textAlign="left"
            maxWidth={wallTextWidth}
          >
            {`Our consumption of digital art is increasingly mediated by recommendation systems that prioritize popularity; the more views an artwork has, the better it must be and the more it deserves to be shown.\n\nZero Views Museum responds to this context by employing counter functional design principles to create an immersive virtual reality experience that exclusively exhibits digital artworks with zero views. Once viewed, works are permanently removed from the database, making participants both the first and potentially last person to see them.\n\nThis encounter invites reflection from participants: Are algorithms good judges of artistic worth? What unseen works have already been lost? And does our perception of art change when we know we can never see it again?`}
          </Text>
        </group>
      </group>

      {/* Left Wall (short) */}
      <group
        position={[-roomWidth / 2, roomHeight / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <mesh>
          <planeGeometry args={[roomDepth, roomHeight]} />
          <meshStandardMaterial color="white" />
        </mesh>
        {images?.[0] && (
          <Photo position={[0, -0.4, 0]} image={images[0]} canvas="left" />
        )}
      </group>

      {/* Right Wall (short) */}
      <group
        position={[roomWidth / 2, roomHeight / 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <mesh>
          <planeGeometry args={[roomDepth, roomHeight]} />
          <meshStandardMaterial color="white" />
        </mesh>
        {images?.[3] && (
          <Photo position={[0, -0.4, 0]} image={images[3]} canvas="right" />
        )}
      </group>
    </group>
  );
}
