// Unfortunately WebXR doesn't support iframes, so this component and the Vimeo data is unused.

import { useRef, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Plane, Text } from "@react-three/drei";

export default function Video({ position }) {
  const videoRef = useRef();
  const [video, setVideo] = useState();

  useEffect(() => {
    // Create a video element
    const videoElement = document.createElement("video");
    videoElement.src =
      "https://player.vimeo.com/progressive_redirect/playback/86701482";
    videoElement.crossOrigin = "anonymous";
    videoElement.loop = true;
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.autoplay = true;

    // Play the video
    videoElement.play().then(() => {
      setVideo(videoElement);
    });

    return () => {
      if (videoElement) {
        videoElement.pause();
        videoElement.removeAttribute("src");
        videoElement.load();
      }
    };
  }, []);

  return (
    <group position={position}>
      {/* Plane with Video Texture */}
      {video && (
        <Plane args={[1.78, 1]}>
          <meshBasicMaterial attach="material">
            <videoTexture attach="map" args={[video]} />
          </meshBasicMaterial>
        </Plane>
      )}
    </group>
  );
}
