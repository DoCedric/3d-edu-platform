"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useState } from "react";
import { CoordinatePointScene, COORDINATE_POINT_START } from "@/scenes/coordinate-point/CoordinatePointScene";

const AXIS_COLORS = { x: "#e5484d", y: "#30a46c", z: "#3b82f6" };
const ORIGIN_COLOR = "#ffb020";

/** Standalone, chrome-free page meant to be embedded (e.g. as an iframe in a
 * Superhuman doc) rather than navigated to inside the lesson shell. Keep
 * pages under /embed self-contained: no site nav, own HUD, own instructions. */
export default function CoordinatePointEmbedPage() {
  const [position, setPosition] = useState<[number, number, number]>(COORDINATE_POINT_START);
  const [x, y, z] = position;
  const atOrigin = x === 0 && y === 0 && z === 0;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg">
      <Canvas camera={{ position: [7, 5, 8], fov: 50 }}>
        <color attach="background" args={["#1a1a1d"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <CoordinatePointScene onPositionChange={setPosition} />
        <OrbitControls makeDefault />
      </Canvas>

      <div className="absolute top-3 left-3 max-w-[260px] rounded-md border border-border bg-bg-elevated/90 px-4 py-3 text-text shadow-lg backdrop-blur">
        <div className="mb-1 text-xs uppercase tracking-wide text-text-muted">Point coordinates</div>
        <div className="flex gap-3 font-mono text-lg">
          <span style={{ color: AXIS_COLORS.x }}>x: {x}</span>
          <span style={{ color: AXIS_COLORS.y }}>y: {y}</span>
          <span style={{ color: AXIS_COLORS.z }}>z: {z}</span>
        </div>
        {atOrigin && (
          <div className="mt-2 text-xs font-medium" style={{ color: ORIGIN_COLOR }}>
            At the origin — every axis reads 0.
          </div>
        )}
        <div className="mt-2 text-xs leading-snug text-text-muted">
          Drag an arrow on the gizmo to move the point along that axis — coordinates snap to whole numbers.
        </div>
      </div>
    </div>
  );
}
