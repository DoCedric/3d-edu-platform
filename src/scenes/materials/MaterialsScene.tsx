"use client";

import { Environment } from "@react-three/drei";
import { SceneControlValues } from "@/lib/scenes/types";

interface MaterialsSceneProps {
  controlValues?: SceneControlValues;
}

export function MaterialsScene({ controlValues = {} }: MaterialsSceneProps) {
  const color = (controlValues.color as string) ?? "#4f8ef7";
  const metalness = (controlValues.metalness as number) ?? 0.6;
  const roughness = (controlValues.roughness as number) ?? 0.25;

  return (
    <>
      <Environment preset="city" background={false} />
      <mesh>
        <sphereGeometry args={[1.2, 64, 64]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
      </mesh>
    </>
  );
}
