"use client";

import { Html, TransformControls, Edges } from "@react-three/drei";
import { useRef, useState } from "react";
import * as THREE from "three";

const VERTICES = [
  { id: 0, x: -1, y: -1, z: -1 },
  { id: 1, x: 1, y: -1, z: -1 },
  { id: 2, x: -1, y: 1, z: -1 },
  { id: 3, x: 1, y: 1, z: -1 },
  { id: 4, x: -1, y: -1, z: 1 },
  { id: 5, x: 1, y: -1, z: 1 },
  { id: 6, x: -1, y: 1, z: 1 },
  { id: 7, x: 1, y: 1, z: 1 },
] as const;

type Coordinate = [number, number, number];

const INITIAL_POSITION: Coordinate = [1, 1, 0];

function formatCoordinate(value: number) {
  const rounded = Number(value.toFixed(2));
  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(2);
}

function CoordinateLabel({
  id,
  local,
  translation,
}: {
  id: number;
  local: Coordinate;
  translation: Coordinate;
}) {
  const world = local.map((value, index) => value + translation[index]) as Coordinate;

  return (
    <Html
      center
      position={[local[0] * 1.3, local[1] * 1.3, local[2] * 1.3]}
      style={{ pointerEvents: "none" }}
    >
      <div className="w-[104px] rounded-sm border border-white/10 bg-[#101916]/95 px-2 py-1.5 font-mono text-[9px] leading-[1.45] shadow-lg backdrop-blur">
        <div className="mb-0.5 flex items-center justify-between font-sans text-[9px] font-semibold uppercase tracking-wide text-[#e6eee8]">
          <span>Vertex {id}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-[#dce9e1]" />
        </div>
        <div className="whitespace-nowrap text-[#58d6c2]">
          O ({local.map(formatCoordinate).join(", ")})
        </div>
        <div className="whitespace-nowrap text-[#ffb65c]">
          W ({world.map(formatCoordinate).join(", ")})
        </div>
      </div>
    </Html>
  );
}

export function CubeCoordinatesScene() {
  const cubeRef = useRef<THREE.Group>(null!);
  const [translation, setTranslation] = useState<Coordinate>(INITIAL_POSITION);

  const handleObjectChange = () => {
    const position = cubeRef.current?.position;
    if (!position) return;

    const nextPosition: Coordinate = [
      position.x,
      position.y,
      position.z,
    ];

    setTranslation((current) =>
      current.every((value, index) => value === nextPosition[index]) ? current : nextPosition,
    );
  };

  return (
    <>
      <gridHelper args={[12, 12, "#405249", "#26342e"]} position={[0, -2.1, 0]} />
      <group ref={cubeRef} position={INITIAL_POSITION}>
        <mesh>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial color="#8bb9a6" transparent opacity={0.28} roughness={0.35} />
          <Edges color="#c7e2d2" />
        </mesh>

        {VERTICES.map(({ id, x, y, z }) => {
          const local: Coordinate = [x, y, z];
          return (
            <group key={id}>
              <mesh position={local}>
                <sphereGeometry args={[0.065, 16, 16]} />
                <meshStandardMaterial color="#edf4ef" emissive="#507c6b" emissiveIntensity={0.35} />
              </mesh>
              <CoordinateLabel id={id} local={local} translation={translation} />
            </group>
          );
        })}
      </group>

      <TransformControls
        object={cubeRef}
        mode="translate"
        translationSnap={null}
        onObjectChange={handleObjectChange}
      />
    </>
  );
}