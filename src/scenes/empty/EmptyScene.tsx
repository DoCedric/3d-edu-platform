"use client";

export function EmptyScene() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#666666" wireframe />
    </mesh>
  );
}
