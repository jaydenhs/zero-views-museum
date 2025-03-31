import { useFrame } from "@react-three/fiber";
import Photo from "./Photo";

export default function Room({ images, onReload }) {
  return (
    <group>
      {/* Bright Light on Ceiling */}
      <mesh position={[0, 3.5, 0]}>
        <sphereGeometry args={[0.1, 32, 32]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <pointLight position={[0, 3.5, 0]} intensity={40} />

      {/* Ceiling */}
      <mesh position={[0, 4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 4]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Floor */}
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
          {images?.[i] ? (
            <Photo position={[0, -0.4, 0]} image={images[i]} />
          ) : (
            <mesh position={[0, -0.4, 0]}>
              <boxGeometry args={[2.7, 1.5, 0.1]} />
              <meshStandardMaterial color="white" />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
