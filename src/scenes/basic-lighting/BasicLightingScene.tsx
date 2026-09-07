"use client";

export function BasicLightingScene() {
  return (
    <>
      <pointLight position={[2, 2, 2]} intensity={15} color="#ff6b6b" />
      <pointLight position={[-2, 1, -2]} intensity={15} color="#4f8ef7" />
      <mesh>
        <sphereGeometry args={[1.2, 64, 64]} />
        <meshStandardMaterial color="#eeeeee" roughness={0.4} metalness={0.1} />
      </mesh>
      <mesh position={[0, -1.51, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
    </>
  );
}
