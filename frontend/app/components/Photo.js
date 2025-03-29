import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import { Text } from "@react-three/drei";

export default function Photo({ image, position }) {
  const texture = useLoader(TextureLoader, image.url);

  // Aspect ratio calculation
  const aspect = image.width / image.height;
  const resolutionScale = Math.min(image.width, image.height) / 500;
  const scaledW = Math.max(1.5, Math.min(2.7, 2 * resolutionScale));
  const scaledH = scaledW / aspect;

  const frameW = 0.05;
  const fontSize = 0.015;

  // IRL: 5" x 7"
  // Translates to 0.15 x 0.21 units
  const plateH = 0.15;
  const plateW = 0.21;

  const creatorName =
    image.creator_name.split(" ").slice(0, 2).join(" ") || "Unknown Artist";
  const title = image.title.split(" ").slice(0, 10).join(" ") || "Untitled";
  const createdAtYear = new Date(image.created_at).getFullYear();

  return (
    <group position={position}>
      {/* Display Image */}
      <mesh>
        <boxGeometry args={[scaledW, scaledH, 0.1]} />
        <meshStandardMaterial map={texture} />
      </mesh>

      <group position={[scaledW / 2 + frameW + plateW / 2 + 0.2, -0.2, 0]}>
        <mesh>
          <boxGeometry args={[plateW, plateH, 0.01]} />
          <meshStandardMaterial color="#E5E5E5" />
        </mesh>

        <group position={[-plateW / 2 + 0.02, plateH / 2 - 0.03, 0.01]}>
          <Text
            font="/fonts/Libre_Franklin/static/LibreFranklin-Bold.ttf"
            fontSize={fontSize}
            color="black"
            anchorX="left"
            position={[0, 0, 0]}
          >
            {creatorName}
          </Text>
          <Text
            font="/fonts/Libre_Franklin/static/LibreFranklin-MediumItalic.ttf"
            fontSize={fontSize * 0.8}
            color="black"
            anchorY="top"
            anchorX="left"
            position={[0, -0.02, 0]}
            maxWidth={plateW - 0.04}
            overflowWrap="break-word"
          >
            {title}, {createdAtYear}
          </Text>
        </group>
      </group>
    </group>
  );
}
