"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useState } from "react";
import {
  LIGHT_START,
  ShadingTechniquesScene,
  type Coordinate,
  type ShadingMode,
} from "@/scenes/shading-techniques/ShadingTechniquesScene";

const SHADING_OPTIONS: { id: ShadingMode; label: string }[] = [
  { id: "flat", label: "Flat Shading" },
  { id: "gouraud", label: "Gouraud Shading" },
  { id: "phong", label: "Phong Shading (Smooth Shading)" },
];

/** Standalone, chrome-free page meant to be embedded (e.g. as an iframe in a
 * Superhuman doc) rather than navigated to inside the lesson shell. Keep
 * pages under /embed self-contained: no site nav, own HUD, own instructions. */
export default function ShadingTechniquesEmbedPage() {
  const [shadingMode, setShadingMode] = useState<ShadingMode>("phong");
  const [lightPosition, setLightPosition] = useState<Coordinate>(LIGHT_START);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg">
      <Canvas camera={{ position: [3.6, 2.6, 4.2], fov: 45 }}>
        <color attach="background" args={["#1a1a1d"]} />
        <ambientLight intensity={0.12} />
        <ShadingTechniquesScene
          shadingMode={shadingMode}
          lightPosition={lightPosition}
          onLightPositionChange={setLightPosition}
        />
        <OrbitControls makeDefault />
      </Canvas>

      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1 rounded-md border border-border bg-bg-elevated/90 p-1 shadow-lg backdrop-blur">
        {SHADING_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() => setShadingMode(option.id)}
            className={`rounded px-3 py-1.5 text-sm transition-colors ${
              shadingMode === option.id ? "bg-accent text-accent-foreground" : "text-text-muted hover:text-text"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="absolute bottom-3 left-3 max-w-[280px] rounded-md border border-border bg-bg-elevated/90 px-4 py-3 text-text shadow-lg backdrop-blur">
        <div className="mb-1 text-xs uppercase tracking-wide text-text-muted">UV sphere · shading techniques</div>
        <div className="text-xs leading-snug text-text-muted">
          Drag the light to move its specular highlight across the sphere and compare how each technique renders it.
        </div>
      </div>
    </div>
  );
}
