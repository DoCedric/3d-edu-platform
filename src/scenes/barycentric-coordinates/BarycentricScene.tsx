"use client";

import { useCallback, useEffect, useMemo } from "react";
import { Html, useTexture } from "@react-three/drei";
import { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { Label3D } from "@/components/scene-kit/Label3D";
import wazowski from "@/imgs/wazowski.png";
import { computeBarycentric, lerpVec3, type Bary, type Vec2, type Vec3 } from "./barycentric";

export const TRIANGLE_VERTICES: [Vec3, Vec3, Vec3] = [
  [-1.4, -1.0, 0.3],
  [1.4, -0.9, -0.2],
  [0, 1.3, 0],
];

export const VERTEX_COLORS = ["#f5a623", "#30a46c", "#3b82f6"] as const;
export const VERTEX_LABELS = ["A", "B", "C"] as const;

export const DEFAULT_UVS: [Vec2, Vec2, Vec2] = [
  [0.28, 0.22],
  [0.78, 0.3],
  [0.5, 0.82],
];

const FLAT_COLOR = "#7c9089";

const [V0, V1, V2] = TRIANGLE_VERTICES.map((v) => new THREE.Vector3(...v));
const NORMAL_VEC = new THREE.Vector3().crossVectors(V1.clone().sub(V0), V2.clone().sub(V0)).normalize();
const POSITIONS = new Float32Array(TRIANGLE_VERTICES.flat());
const NORMALS = new Float32Array([NORMAL_VEC.toArray(), NORMAL_VEC.toArray(), NORMAL_VEC.toArray()].flat());

// Start fetching immediately on module load, rather than when the "Display
// texture" checkbox is first checked - Canvas wraps its whole tree in one
// Suspense boundary, so loading on-demand would blank the entire 3D view
// (not just the triangle) the first time the checkbox is ticked.
useTexture.preload(wazowski.src);

function TexturedMaterial() {
  const texture = useTexture(wazowski.src);
  useEffect(() => {
    // useTexture doesn't set colorSpace itself; three.js's Texture only
    // exposes this as a mutable field, so setting it here is unavoidable.
    // eslint-disable-next-line react-hooks/immutability
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);
  return <meshBasicMaterial map={texture} side={THREE.DoubleSide} />;
}

interface BarycentricSceneProps {
  uvs: [Vec2, Vec2, Vec2];
  displayTexture: boolean;
  hoverBary: Bary | null;
  onHoverBary: (bary: Bary | null) => void;
}

/** A single fixed triangle whose vertices carry editable UV coordinates.
 * Hovering the face reports the hit point's barycentric weights outward
 * (for the UV panel to mirror); a hover driven by the UV panel is rendered
 * back here as a fixed-size marker via Html, which stays a literal pixel
 * size regardless of camera zoom. */
export function BarycentricScene({ uvs, displayTexture, hoverBary, onHoverBary }: BarycentricSceneProps) {
  const uvArray = useMemo(() => new Float32Array(uvs.flat()), [uvs]);

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const bary = computeBarycentric([event.point.x, event.point.y, event.point.z], ...TRIANGLE_VERTICES);
      onHoverBary(bary);
    },
    [onHoverBary]
  );

  const handlePointerOut = useCallback(() => onHoverBary(null), [onHoverBary]);

  return (
    <>
      <mesh onPointerMove={handlePointerMove} onPointerOut={handlePointerOut}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[POSITIONS, 3]} />
          <bufferAttribute attach="attributes-normal" args={[NORMALS, 3]} />
          <bufferAttribute attach="attributes-uv" args={[uvArray, 2]} />
        </bufferGeometry>
        {displayTexture ? (
          <TexturedMaterial />
        ) : (
          // Unlit (meshBasicMaterial), not meshStandardMaterial: the point of
          // this demo is that a sampled color matches the source exactly, so
          // the triangle must not be darkened/brightened by scene lighting as
          // the student orbits around it.
          <meshBasicMaterial color={FLAT_COLOR} side={THREE.DoubleSide} />
        )}
      </mesh>

      {TRIANGLE_VERTICES.map((position, i) => (
        <mesh key={i} position={position} raycast={() => {}}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color={VERTEX_COLORS[i]} />
          <Label3D text={VERTEX_LABELS[i]} color={VERTEX_COLORS[i]} position={[0, 0.26, 0]} size={0.28} />
        </mesh>
      ))}

      {hoverBary && (
        <Html center position={lerpVec3(hoverBary, ...TRIANGLE_VERTICES)} style={{ pointerEvents: "none" }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "red" }} />
        </Html>
      )}
    </>
  );
}
