"use client";

export function TestSphere() {
  return (
    <mesh>
      <sphereGeometry args={[1.2, 64, 64]} />
      <meshStandardMaterial
        color="#4f8ef7"
        metalness={0.6}
        roughness={0.25}
      />
    </mesh>
  );
}
