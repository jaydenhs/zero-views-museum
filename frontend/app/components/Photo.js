import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import { Text } from "@react-three/drei"; // Import the Text component from drei

export default function Photo({ image, position }) {
  const texture = useLoader(TextureLoader, image.url);

  // Aspect ratio calculation
  const aspect = image.width / image.height;
  const resolutionScale = Math.min(image.width, image.height) / 500;
  const scaledW = 2 * resolutionScale;
  const scaledH = (2 / aspect) * resolutionScale;

  const frameW = 0.05;
  const fontSize = 0.03;

  let title = image.title.split(" ").slice(0, 10).join(" ") || "Untitled";
  const createdAtYear = new Date(image.created_at).getFullYear();

  return (
    <group position={position}>
      {/* Display Image */}
      <mesh>
        <planeGeometry args={[scaledW, scaledH]} />
        <meshBasicMaterial map={texture} />
      </mesh>

      {/* Picture frame */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[scaledW + frameW, scaledH + frameW]} />
        <meshBasicMaterial color="black" />
      </mesh>

      <group position={[scaledW / 2 + frameW + 0.25, 0, -0.01]}>
        <mesh>
          <planeGeometry args={[0.5, 0.3]} />
          <meshStandardMaterial color="gray" />
        </mesh>

        <group position={[-0.2, 0, 0.01]}>
          <Text
            position={[0, 0, 0]}
            fontSize={fontSize}
            maxWidth={0.4}
            color="white"
            anchorX="left"
          >
            {`${image.creator_name}\n\n${title}, ${createdAtYear}`}
          </Text>
        </group>
      </group>
    </group>
  );
}
