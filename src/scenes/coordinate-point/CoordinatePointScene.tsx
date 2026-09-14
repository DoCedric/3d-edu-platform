"use client";

import { useMemo, useRef, useState } from "react";
import { Line, TransformControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { AxisGizmo } from "@/components/scene-kit/AxisGizmo";
import { Label3D } from "@/components/scene-kit/Label3D";
import { useTargetMatch } from "@/components/scene-kit/useTargetMatch";

export const ORIGIN: [number, number, number] = [0, 0, 0];
export const COORDINATE_POINT_START: [number, number, number] = [3, 2, -2];

const AXIS_COLORS = { x: "#e5484d", y: "#30a46c", z: "#3b82f6" };
// Muted versions of the same hues, so the fixed global axes read as
// background reference rather than competing with the point's own
// (vividly colored) move gizmo and coordinate staircase.
const GLOBAL_AXIS_COLORS = { x: "#7a3236", y: "#235c3f", z: "#2c4a72" };
const ORIGIN_COLOR = "#ffb020";

interface CoordinatePointSceneProps {
  onPositionChange?: (position: [number, number, number]) => void;
}

/** Lets a learner drag a point through 3D space and watch its (x, y, z)
 * coordinates update, snapped to integers. The dashed "staircase" path shows
 * how the three axis values compose the point's location, and the point
 * highlights when it passes back through the origin. */
export function CoordinatePointScene({ onPositionChange }: CoordinatePointSceneProps) {
  const [position, setPosition] = useState<[number, number, number]>(COORDINATE_POINT_START);
  const atOrigin = useTargetMatch(position, ORIGIN, 0.001);
  const [x, y, z] = position;

  const pointRef = useRef<THREE.Mesh>(null!);
  const orbitControls = useThree((state) => state.controls) as OrbitControlsImpl | null;

  const handlePositionChange = (next: [number, number, number]) => {
    setPosition(next);
    onPositionChange?.(next);
  };

  const handleGizmoChange = () => {
    const point = pointRef.current;
    if (!point) return;
    handlePositionChange([Math.round(point.position.x), Math.round(point.position.y), Math.round(point.position.z)]);
  };

  const legX = useMemo(() => [[0, 0, 0], [x, 0, 0]] as [number, number, number][], [x]);
  const legY = useMemo(() => [[x, 0, 0], [x, y, 0]] as [number, number, number][], [x, y]);
  const legZ = useMemo(() => [[x, y, 0], [x, y, z]] as [number, number, number][], [x, y, z]);

  return (
    <>
      <AxisGizmo length={5} colors={GLOBAL_AXIS_COLORS} />

      <mesh position={ORIGIN}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={ORIGIN_COLOR} />
      </mesh>
      <Label3D text="Origin (0, 0, 0)" color={ORIGIN_COLOR} position={[0, -0.5, 0]} />

      <Line points={legX} color={AXIS_COLORS.x} dashed dashSize={0.15} gapSize={0.1} lineWidth={1.5} />
      <Line points={legY} color={AXIS_COLORS.y} dashed dashSize={0.15} gapSize={0.1} lineWidth={1.5} />
      <Line points={legZ} color={AXIS_COLORS.z} dashed dashSize={0.15} gapSize={0.1} lineWidth={1.5} />

      <mesh ref={pointRef} position={position}>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshStandardMaterial
          color={atOrigin ? ORIGIN_COLOR : "#4f8ef7"}
          emissive={atOrigin ? ORIGIN_COLOR : "#000000"}
          emissiveIntensity={atOrigin ? 0.5 : 0}
        />
      </mesh>
      <TransformControls
        object={pointRef}
        mode="translate"
        translationSnap={1}
        onObjectChange={handleGizmoChange}
        onMouseDown={() => {
          if (orbitControls) orbitControls.enabled = false;
        }}
        onMouseUp={() => {
          if (orbitControls) orbitControls.enabled = true;
        }}
      />

      <Label3D text={`(${x}, ${y}, ${z})`} color={atOrigin ? ORIGIN_COLOR : "#ffffff"} position={[x, y + 1, z]} />
    </>
  );
}
