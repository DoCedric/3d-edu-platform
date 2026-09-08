"use client";

import { Environment } from "@react-three/drei";
import { SceneControlValues } from "@/lib/scenes/types";

interface ComparisonSceneProps {
  controlValues?: SceneControlValues;
}

const VARIANT_A = { metalness: 0.9, roughness: 0.1 };
const VARIANT_B = { metalness: 0.05, roughness: 0.9 };

export function ComparisonScene({ controlValues = {} }: ComparisonSceneProps) {
  const viewMode = (controlValues.viewMode as string) ?? "side-by-side";
  const color = (controlValues.color as string) ?? "#4f8ef7";

  const showA = viewMode === "side-by-side" || viewMode === "variant-a";
  const showB = viewMode === "side-by-side" || viewMode === "variant-b";
  const offset = viewMode === "side-by-side" ? 1.5 : 0;

  return (
    <>
      <Environment preset="city" background={false} />
      {showA && (
        <mesh position={[-offset, 0, 0]}>
          <sphereGeometry args={[1, 64, 64]} />
          <meshStandardMaterial color={color} metalness={VARIANT_A.metalness} roughness={VARIANT_A.roughness} />
        </mesh>
      )}
      {showB && (
        <mesh position={[offset, 0, 0]}>
          <sphereGeometry args={[1, 64, 64]} />
          <meshStandardMaterial color={color} metalness={VARIANT_B.metalness} roughness={VARIANT_B.roughness} />
        </mesh>
      )}
    </>
  );
}
