import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import { Text } from "@react-three/drei";

export default function Photo({ image, position, canvas }) {
  const uri = image?.displayUrl;
  const texture = useLoader(TextureLoader, uri || null);

  if (!image) {
    return (
      <group position={position} userData={{ canvas }} name={canvas || "photo"}>
        <mesh>
          <boxGeometry args={[2.7, 1.5, 0.1]} />
          <meshStandardMaterial color="white" />
        </mesh>
      </group>
    );
  }

  // Calculate dimensions preserving aspect ratio with maximums
  const aspect = image.width / image.height;
  let photoW, photoH;
  if (aspect > 1) {
    // Landscape image - width is the limiting factor
    photoW = 2;
    photoH = 2 / aspect;
  } else {
    // Portrait image - height is the limiting factor
    photoH = 2.5;
    photoW = 2.5 * aspect;
  }

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
    <group position={position} userData={{ canvas }} name={canvas || "photo"}>
      {/* Photo */}
      <mesh>
        <boxGeometry args={[photoW, photoH, 0.1]} />
        <meshStandardMaterial map={texture} />
      </mesh>
      {/* Plaque */}
      <group position={[photoW / 2 + frameW + plateW / 2 + 0.2, -0.2, 0]}>
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
