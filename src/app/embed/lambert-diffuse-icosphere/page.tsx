"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useState } from "react";
import {
  LambertDiffuseIcosphereScene,
  LIGHT_START,
  type Coordinate,
} from "@/scenes/lambert-diffuse-icosphere/LambertDiffuseIcosphereScene";

const NORMAL_COLOR = "#58d6c2";
const LIGHT_COLOR = "#ffd166";

interface Checkbox {
  id: "showNormals" | "showLight" | "showLightVectors" | "showDiffuseColor";
  label: string;
  color: string;
}

const CHECKBOXES: Checkbox[] = [
  { id: "showNormals", label: "Face normals", color: NORMAL_COLOR },
  { id: "showLight", label: "Light (draggable)", color: LIGHT_COLOR },
  { id: "showLightVectors", label: "Vectors to light", color: LIGHT_COLOR },
  { id: "showDiffuseColor", label: "Diffuse shading on sphere", color: "#dfe8e4" },
];

/** Standalone, chrome-free page meant to be embedded (e.g. as an iframe in a
 * Superhuman doc) rather than navigated to inside the lesson shell. Keep
 * pages under /embed self-contained: no site nav, own HUD, own instructions. */
export default function LambertDiffuseIcosphereEmbedPage() {
  const [lightPosition, setLightPosition] = useState<Coordinate>(LIGHT_START);
  const [visibility, setVisibility] = useState({
    showNormals: false,
    showLight: false,
    showLightVectors: false,
    showDiffuseColor: false,
  });

  const toggle = (id: Checkbox["id"]) => setVisibility((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg">
      <Canvas camera={{ position: [4, 3, 5], fov: 45 }}>
        <color attach="background" args={["#1a1a1d"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <LambertDiffuseIcosphereScene
          lightPosition={lightPosition}
          onLightPositionChange={setLightPosition}
          showNormals={visibility.showNormals}
          showLight={visibility.showLight}
          showLightVectors={visibility.showLightVectors}
          showDiffuseColor={visibility.showDiffuseColor}
        />
        <OrbitControls makeDefault />
      </Canvas>

      <div className="absolute top-3 left-3 max-w-[240px] rounded-md border border-border bg-bg-elevated/90 px-4 py-3 text-text shadow-lg backdrop-blur">
        <div className="mb-2 text-xs uppercase tracking-wide text-text-muted">Lambert diffuse — icosphere</div>
        <div className="flex flex-col gap-2">
          {CHECKBOXES.map(({ id, label, color }) => (
            <label key={id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={visibility[id]}
                onChange={() => toggle(id)}
                className="h-4 w-4"
                style={{ accentColor: color }}
              />
              <span style={{ color }}>{label}</span>
            </label>
          ))}
        </div>
        <div className="mt-2 text-xs leading-snug text-text-muted">
          Drag the light — every face shades by its own angle to it.
        </div>
      </div>
    </div>
  );
}
