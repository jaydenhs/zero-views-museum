import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import { Text } from "@react-three/drei"; // Import the Text component from drei

export default function Photo({ image, position }) {
  console.log({ image });
  const texture = useLoader(TextureLoader, image.url);

  // Aspect ratio calculation
  const aspect = image.width / image.height;

  const frameW = 0.1;
  const fontSize = 0.05;

  // Extract the year from the created_at datetime
  const createdAtYear = new Date(image.created_at).getFullYear();

  return (
    <group position={position}>
      {/* Display Image */}
      <mesh>
        <planeGeometry args={[2, 2 / aspect]} /> {/* Dynamic aspect ratio */}
        <meshBasicMaterial map={texture} />
      </mesh>

      {/* Picture frame */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[2 + frameW, 2 / aspect + frameW]} />
        <meshBasicMaterial color="black" />
      </mesh>

      <group position={[1.35, 0, -0.01]}>
        <mesh>
          <planeGeometry args={[0.5, 0.25]} />
          <meshStandardMaterial color="gray" />
        </mesh>

        <group position={[-0.2, 0.05, 0.01]}>
          <Text
            position={[0, -0.1, 0]}
            fontSize={fontSize}
            color="white"
            anchorX="left"
          >
            {`${image.creator_name}`}
          </Text>
          <Text
            position={[0, 0, 0]}
            fontSize={fontSize}
            color="white"
            fontStyle="italic"
            anchorX="left"
          >
            {`${image.title}, ${createdAtYear}`}
          </Text>
        </group>
      </group>
    </group>
  );
}
