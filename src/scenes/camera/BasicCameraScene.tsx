"use client";

import { PerspectiveCamera, OrthographicCamera } from "@react-three/drei";
import { SceneControlValues } from "@/lib/scenes/types";

interface BasicCameraSceneProps {
  controlValues?: SceneControlValues;
}

const CUBE_POSITIONS: [number, number, number][] = [
  [-3, 0, -6],
  [-1.5, 0, -3],
  [0, 0, 0],
  [1.5, 0, 3],
  [3, 0, 6],
];

export function BasicCameraScene({ controlValues = {} }: BasicCameraSceneProps) {
  const projection = (controlValues.projection as string) ?? "perspective";

  return (
    <>
      {projection === "orthographic" ? (
        <OrthographicCamera makeDefault position={[6, 6, 6]} zoom={60} near={0.1} far={100} />
      ) : (
        <PerspectiveCamera makeDefault position={[6, 6, 6]} fov={50} near={0.1} far={100} />
      )}
      {CUBE_POSITIONS.map((position) => (
        <mesh key={position.join(",")} position={position}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#4f8ef7" />
        </mesh>
      ))}
    </>
  );
}
