import { useXRInputSourceState } from "@react-three/xr";
import { useFrame } from "@react-three/fiber";
import { useState } from "react";

export function VRControls({ onReload }) {
  const controllerRight = useXRInputSourceState("controller", "right");
  const [buttonPressed, setButtonPressed] = useState(false);

  useFrame(() => {
    const isPressed =
      controllerRight?.gamepad?.["a-button"]?.state === "pressed";

    if (isPressed && !buttonPressed) {
      onReload?.();
      setButtonPressed(true);
    } else if (!isPressed && buttonPressed) {
      setButtonPressed(false);
    }
  });

  return null;
}
