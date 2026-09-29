"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useState } from "react";
import {
  computeCosine,
  LambertDiffuseScene,
  LIGHT_START,
  type Coordinate,
} from "@/scenes/lambert-diffuse/LambertDiffuseScene";

const NORMAL_COLOR = "#58d6c2";
const LIGHT_COLOR = "#ffd166";

interface Checkbox {
  id: "showNormal" | "showLight" | "showLightVector" | "showGradient" | "showDiffuseColor";
  label: string;
  color: string;
}

const CHECKBOXES: Checkbox[] = [
  { id: "showNormal", label: "Normal vector (N)", color: NORMAL_COLOR },
  { id: "showLight", label: "Light (draggable)", color: LIGHT_COLOR },
  { id: "showLightVector", label: "Vector to light (L)", color: LIGHT_COLOR },
  { id: "showGradient", label: "Gradient readout", color: "#dfe8e4" },
  { id: "showDiffuseColor", label: "Diffuse shading on triangle", color: "#dfe8e4" },
];

/** Standalone, chrome-free page meant to be embedded (e.g. as an iframe in a
 * Superhuman doc) rather than navigated to inside the lesson shell. Keep
 * pages under /embed self-contained: no site nav, own HUD, own instructions. */
export default function LambertDiffuseEmbedPage() {
  const [lightPosition, setLightPosition] = useState<Coordinate>(LIGHT_START);
  const [visibility, setVisibility] = useState({
    showNormal: false,
    showLight: false,
    showLightVector: false,
    showGradient: false,
    showDiffuseColor: false,
  });

  const toggle = (id: Checkbox["id"]) => setVisibility((prev) => ({ ...prev, [id]: !prev[id] }));

  const cosine = useMemo(() => computeCosine(lightPosition), [lightPosition]);
  const angleDeg = (Math.acos(cosine) * 180) / Math.PI;
  const clampedCosine = Math.max(0, cosine);
  const markerPercent = clampedCosine * 100;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg">
      <Canvas camera={{ position: [4, 3, 5], fov: 45 }}>
        <color attach="background" args={["#1a1a1d"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <LambertDiffuseScene
          lightPosition={lightPosition}
          onLightPositionChange={setLightPosition}
          showNormal={visibility.showNormal}
          showLight={visibility.showLight}
          showLightVector={visibility.showLightVector}
          showDiffuseColor={visibility.showDiffuseColor}
        />
        <OrbitControls makeDefault />
      </Canvas>

      <div className="absolute top-3 left-3 max-w-[240px] rounded-md border border-border bg-bg-elevated/90 px-4 py-3 text-text shadow-lg backdrop-blur">
        <div className="mb-2 text-xs uppercase tracking-wide text-text-muted">Lambert diffuse</div>
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
          Drag the light to change the angle between it and the surface normal.
        </div>
      </div>

      <div className="absolute top-3 right-3 max-w-[364px] rounded-md border border-border bg-bg-elevated/90 px-[21px] py-4 text-text shadow-lg backdrop-blur">
        <div className="font-mono text-[18px]">
          &theta; = {angleDeg.toFixed(1)}&deg;&nbsp;&nbsp; cos(&theta;) = {cosine.toFixed(2)}
        </div>
        {cosine < 0 && (
          <div className="mt-1 text-[13px] text-text-muted">Light is behind the surface — clamped to 0 for shading.</div>
        )}

        {visibility.showGradient && (
          <div className="mt-4">
            <div className="relative h-4 w-full rounded-sm" style={{ background: "linear-gradient(to right, #000000, #ffffff)" }}>
              <div
                className="absolute -top-2 h-8 w-0 -translate-x-1/2"
                style={{ left: `${markerPercent}%` }}
              >
                <div
                  className="mx-auto h-0 w-0 border-x-[7px] border-t-[9px] border-x-transparent"
                  style={{ borderTopColor: "#ff4d4d" }}
                />
              </div>
            </div>
            <div className="mt-1 flex justify-between text-[13px] text-text-muted">
              <span>0.0</span>
              <span>1.0</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
