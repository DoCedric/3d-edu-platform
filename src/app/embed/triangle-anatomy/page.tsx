"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useState } from "react";
import {
  TriangleAnatomyScene,
  TriangleAnatomyVisibility,
  VERTEX_COLOR,
  EDGE_COLOR,
  FACE_COLOR,
} from "@/scenes/triangle-anatomy/TriangleAnatomyScene";

const CHECKBOXES: { id: keyof TriangleAnatomyVisibility; label: string; color: string }[] = [
  { id: "vertices", label: "Vertices", color: VERTEX_COLOR },
  { id: "edges", label: "Edges", color: EDGE_COLOR },
  { id: "faces", label: "Faces", color: FACE_COLOR },
];

/** Standalone, chrome-free page meant to be embedded (e.g. as an iframe in a
 * Superhuman doc) rather than navigated to inside the lesson shell. */
export default function TriangleAnatomyEmbedPage() {
  const [visibility, setVisibility] = useState<TriangleAnatomyVisibility>({
    vertices: false,
    edges: false,
    faces: false,
  });

  const toggle = (id: keyof TriangleAnatomyVisibility) => setVisibility((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg">
      <Canvas camera={{ position: [0, 0, 6], fov: 50 }}>
        <color attach="background" args={["#1a1a1d"]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <TriangleAnatomyScene visibility={visibility} />
        <OrbitControls makeDefault />
      </Canvas>

      <div className="absolute top-3 left-3 max-w-[220px] rounded-md border border-border bg-bg-elevated/90 px-4 py-3 text-text shadow-lg backdrop-blur">
        <div className="mb-2 text-xs uppercase tracking-wide text-text-muted">Triangle anatomy</div>
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
      </div>
    </div>
  );
}
