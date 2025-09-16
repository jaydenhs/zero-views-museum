"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { processImageForLEDStrip } from "../lib/imageProcessing";
import { toFlickrSize } from "../lib/flickr";

export default function GazeRaycaster({ ws, images }) {
  const { camera, scene } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());
  const lastCanvasRef = useRef(null);

  useFrame(() => {
    if (!camera || !scene) return;

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);

    const raycaster = raycasterRef.current;
    raycaster.set(camera.position.clone(), dir);

    const intersects = raycaster.intersectObjects(scene.children, true);

    let canvas = null;
    for (const it of intersects) {
      let obj = it.object;
      while (obj) {
        if (obj.userData && obj.userData.canvas) {
          canvas = obj.userData.canvas;
          break;
        }
        obj = obj.parent;
      }
      if (canvas) break;
    }

    if (canvas && canvas !== lastCanvasRef.current) {
      lastCanvasRef.current = canvas;
      const target = canvas;
      if (ws.current && ws.current.readyState === WebSocket.OPEN && target) {
        let imageData = null;
        if (canvas === "centerLeft" && images[1]) {
          imageData = images[1];
        } else if (canvas === "centerRight" && images[2]) {
          imageData = images[2];
        } else if (canvas === "left" && images[0]) {
          imageData = images[0];
        } else if (canvas === "right" && images[3]) {
          imageData = images[3];
        }

        if (imageData) {
          // Use smallest Flickr size for LED processing (bandwidth-friendly)
          processImageForLEDStrip(toFlickrSize(imageData.url, "t"))
            .then((ledArray) => {
              const canvasId = canvas;
              const canvasBytes = new TextEncoder().encode(canvasId);
              const ledBytes = new Uint8Array(ledArray);
              const header = new Uint8Array([canvasBytes.length]);
              const combinedMessage = new Uint8Array(
                1 + canvasBytes.length + ledBytes.length
              );
              combinedMessage.set(header, 0);
              combinedMessage.set(canvasBytes, 1);
              combinedMessage.set(ledBytes, 1 + canvasBytes.length);
              ws.current.send(combinedMessage);
            })
            .catch(() => {});
        }
      }
    } else if (!canvas && lastCanvasRef.current) {
      const target = lastCanvasRef.current;
      if (ws.current && ws.current.readyState === WebSocket.OPEN && target) {
        const canvasId = target;
        const canvasBytes = new TextEncoder().encode(canvasId);
        const clearCommand = new Uint8Array([0]);
        const header = new Uint8Array([canvasBytes.length]);
        const combinedMessage = new Uint8Array(1 + canvasBytes.length + 1);
        combinedMessage.set(header, 0);
        combinedMessage.set(canvasBytes, 1);
        combinedMessage.set(clearCommand, 1 + canvasBytes.length);
        ws.current.send(combinedMessage);
      }
      lastCanvasRef.current = null;
    }
  });

  return null;
}
