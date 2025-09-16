"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export default function GazeRaycaster({ ws, images }) {
  const { camera, scene } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());
  const lastCanvasRef = useRef(null);
  const postingRef = useRef({ ctrl: null, lastTs: 0, inFlight: false });

  const postState = async (canvasId, lookedAt) => {
    try {
      const now = Date.now();
      postingRef.current.lastTs = now;
      // Abort any in-flight request; we only care about latest intent
      if (postingRef.current.ctrl) {
        try {
          postingRef.current.ctrl.abort();
        } catch (_) {}
      }
      const ctrl = new AbortController();
      postingRef.current.ctrl = ctrl;
      postingRef.current.inFlight = true;
      await fetch(`/api/canvas/${canvasId}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookedAt, ts: now }),
        // keepalive helps allow requests during page unloads; harmless otherwise
        keepalive: true,
        signal: ctrl.signal,
      });
    } catch (e) {
      // Silent fail to avoid spamming console during renders
    } finally {
      postingRef.current.inFlight = false;
    }
  };

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
      console.log("Looking at canvas:", canvas);
      lastCanvasRef.current = canvas;
      const target = canvas;
      if (target) {
        // Notify server immediately that this canvas is being looked at
        postState(target, true);

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
          const sendBytes = (ledArr) => {
            const canvasId = canvas;
            const ledBytes = new Uint8Array(ledArr); // 900*3 bytes
            // POST raw bytes to the imageBytes endpoint for this canvas
            try {
              fetch(`/api/canvas/${canvasId}/imageBytes`, {
                method: "POST",
                headers: { "Content-Type": "application/octet-stream" },
                body: ledBytes,
                keepalive: true,
              });
            } catch (_) {}
            console.log(
              "Posted imageBytes (",
              ledBytes.byteLength,
              "bytes) for:",
              canvasId
            );
          };
          if (imageData.ledArray && imageData.ledArray.length) {
            sendBytes(imageData.ledArray);
          }
        }
      }
    } else if (!canvas && lastCanvasRef.current) {
      console.log("Not looking at canvas:", lastCanvasRef.current);
      const target = lastCanvasRef.current;
      if (target) {
        // Notify server that this canvas is no longer looked at
        postState(target, false);
        // Optionally clear imageBytes for this canvas
        try {
          fetch(`/api/canvas/${target}/imageBytes`, {
            method: "DELETE",
            keepalive: true,
          });
        } catch (_) {}
      }
      lastCanvasRef.current = null;
    }
  });

  return null;
}
