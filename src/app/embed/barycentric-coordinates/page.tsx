"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useState } from "react";
import {
  BarycentricScene,
  DEFAULT_UVS,
  VERTEX_COLORS,
  VERTEX_LABELS,
} from "@/scenes/barycentric-coordinates/BarycentricScene";
import { computeBarycentric, isInsideTriangle, lerpVec2, type Bary, type Vec2 } from "@/scenes/barycentric-coordinates/barycentric";
import wazowski from "@/imgs/wazowski.png";

const VERTEX_HIT_PX = 14;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

interface UvInspectorPanelProps {
  uvs: [Vec2, Vec2, Vec2];
  onVertexDrag: (index: 0 | 1 | 2, next: Vec2) => void;
  hoverBary: Bary | null;
  onHoverBary: (bary: Bary | null) => void;
}

/** Flat UV-space counterpart to the 3D triangle: the full texture image with
 * the current UV triangle overlaid. Hovering its interior reports barycentric
 * weights outward (mirrored on the 3D triangle); hovering/dragging a vertex
 * remaps that vertex's UV coordinate. Vertex and sample markers are literal
 * CSS-pixel-sized divs (not SVG, which would scale with the container) so
 * their size stays exact however this panel is resized. */
function UvInspectorPanel({ uvs, onVertexDrag, hoverBary, onHoverBary }: UvInspectorPanelProps) {
  const [hoveredVertex, setHoveredVertex] = useState<0 | 1 | 2 | null>(null);
  const [draggingVertex, setDraggingVertex] = useState<0 | 1 | 2 | null>(null);
  const [hoverUV, setHoverUV] = useState<Vec2 | null>(null);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const u = localX / rect.width;
    const v = 1 - localY / rect.height;
    // Tracks the raw pointer position anywhere over the image - independent
    // of the triangle hit-test below, so e.g. (0,0) is visible even where
    // there's no barycentric sample to show.
    setHoverUV([clamp01(u), clamp01(v)]);

    if (draggingVertex !== null) {
      onVertexDrag(draggingVertex, [clamp01(u), clamp01(v)]);
      return;
    }

    let nearestIndex: 0 | 1 | 2 | null = null;
    let nearestDist = VERTEX_HIT_PX;
    uvs.forEach((uv, i) => {
      const vertexX = uv[0] * rect.width;
      const vertexY = (1 - uv[1]) * rect.height;
      const dist = Math.hypot(localX - vertexX, localY - vertexY);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIndex = i as 0 | 1 | 2;
      }
    });

    if (nearestIndex !== null) {
      setHoveredVertex(nearestIndex);
      onHoverBary(null);
      return;
    }
    setHoveredVertex(null);

    const bary = computeBarycentric([u, v], uvs[0], uvs[1], uvs[2]);
    onHoverBary(bary && isInsideTriangle(bary) ? bary : null);
  };

  const handlePointerLeave = () => {
    setHoveredVertex(null);
    setHoverUV(null);
    if (draggingVertex === null) onHoverBary(null);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (hoveredVertex === null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingVertex(hoveredVertex);
    onHoverBary(null);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draggingVertex === null) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDraggingVertex(null);
  };

  const sample = hoverBary ? lerpVec2(hoverBary, uvs[0], uvs[1], uvs[2]) : null;
  const polygonPoints = uvs.map(([u, v]) => `${u * 100},${(1 - v) * 100}`).join(" ");

  return (
    <div className="flex h-full w-1/2 items-center justify-center p-6">
      <div
        className="relative aspect-square h-full max-h-[560px] w-auto max-w-[min(100%,560px)] touch-none overflow-hidden rounded-md border border-border"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={wazowski.src}
          alt="Texture being UV-mapped onto the 3D triangle"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        />

        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
          <polygon points={polygonPoints} fill="white" fillOpacity={0.12} stroke="white" strokeOpacity={0.7} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </svg>

        {uvs.map(([u, v], i) => {
          const active = hoveredVertex === i || draggingVertex === i;
          return (
            <div key={i} className="pointer-events-none absolute" style={{ left: `${u * 100}%`, top: `${(1 - v) * 100}%` }}>
              <div
                style={{
                  width: active ? 20 : 14,
                  height: active ? 20 : 14,
                  borderRadius: "50%",
                  background: VERTEX_COLORS[i],
                  border: active ? "2px solid white" : "none",
                  transform: "translate(-50%, -50%)",
                }}
              />
              <span
                className="absolute text-xs font-semibold"
                style={{ left: 12, top: -18, color: VERTEX_COLORS[i], textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
              >
                {VERTEX_LABELS[i]}
              </span>
            </div>
          );
        })}

        {sample && (
          <div
            className="pointer-events-none absolute"
            style={{
              left: `${sample[0] * 100}%`,
              top: `${(1 - sample[1]) * 100}%`,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "red",
              transform: "translate(-50%, -50%)",
            }}
          />
        )}

        {hoverUV && (
          <div className="pointer-events-none absolute top-3 left-3 rounded-md border border-border bg-bg-elevated/90 px-3 py-2 text-text shadow-lg backdrop-blur">
            <div className="font-mono text-xs">
              u = {hoverUV[0].toFixed(2)}&nbsp;&nbsp;v = {hoverUV[1].toFixed(2)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Standalone, chrome-free page meant to be embedded (e.g. as an iframe in a
 * Superhuman doc) rather than navigated to inside the lesson shell. Keep
 * pages under /embed self-contained: no site nav, own HUD, own instructions. */
export default function BarycentricCoordinatesEmbedPage() {
  const [uvs, setUvs] = useState<[Vec2, Vec2, Vec2]>(DEFAULT_UVS);
  const [displayTexture, setDisplayTexture] = useState(false);
  const [hoverBary, setHoverBary] = useState<Bary | null>(null);

  const handleVertexDrag = (index: 0 | 1 | 2, next: Vec2) => {
    setUvs((prev) => {
      const updated = [...prev] as [Vec2, Vec2, Vec2];
      updated[index] = next;
      return updated;
    });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      <div className="relative h-full w-1/2 border-r border-border">
        <Canvas camera={{ position: [4, 3, 5], fov: 45 }}>
          <color attach="background" args={["#1a1a1d"]} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={0.9} />
          <BarycentricScene uvs={uvs} displayTexture={displayTexture} hoverBary={hoverBary} onHoverBary={setHoverBary} />
          <OrbitControls makeDefault />
        </Canvas>

        <div className="absolute top-3 left-3 max-w-[240px] rounded-md border border-border bg-bg-elevated/90 px-4 py-3 text-text shadow-lg backdrop-blur">
          <div className="mb-2 text-xs uppercase tracking-wide text-text-muted">Barycentric coordinates</div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={displayTexture}
              onChange={() => setDisplayTexture((prev) => !prev)}
              className="h-4 w-4"
            />
            <span>Display texture</span>
          </label>
          <div className="mt-2 text-xs leading-snug text-text-muted">
            Hover either triangle to sample a point. Drag a vertex on the image to remap its UV.
          </div>
        </div>

        {hoverBary && (
          <div className="absolute top-3 right-3 rounded-md border border-border bg-bg-elevated/90 px-4 py-3 text-text shadow-lg backdrop-blur">
            <div className="font-mono text-sm">
              {VERTEX_LABELS.map((label, i) => (
                <span key={label}>
                  <span style={{ color: VERTEX_COLORS[i] }}>{label.toLowerCase()}</span> = {hoverBary[i].toFixed(2)}
                  {i < VERTEX_LABELS.length - 1 && <>&nbsp;&nbsp;</>}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <UvInspectorPanel uvs={uvs} onVertexDrag={handleVertexDrag} hoverBary={hoverBary} onHoverBary={setHoverBary} />
    </div>
  );
}
