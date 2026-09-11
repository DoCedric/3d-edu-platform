"use client";

import { useMemo, useState } from "react";
import { Line } from "@react-three/drei";
import { AxisGizmo } from "@/components/scene-kit/AxisGizmo";
import { DraggableObject } from "@/components/scene-kit/DraggableObject";
import { Label3D } from "@/components/scene-kit/Label3D";
import { useTargetMatch } from "@/components/scene-kit/useTargetMatch";

export const ORIGIN: [number, number, number] = [0, 0, 0];
export const COORDINATE_POINT_START: [number, number, number] = [3, 2, -2];

const AXIS_COLORS = { x: "#e5484d", y: "#30a46c", z: "#3b82f6" };
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

  const handlePositionChange = (next: [number, number, number]) => {
    setPosition(next);
    onPositionChange?.(next);
  };

  const legX = useMemo(() => [[0, 0, 0], [x, 0, 0]] as [number, number, number][], [x]);
  const legY = useMemo(() => [[x, 0, 0], [x, y, 0]] as [number, number, number][], [x, y]);
  const legZ = useMemo(() => [[x, y, 0], [x, y, z]] as [number, number, number][], [x, y, z]);

  return (
    <>
      <AxisGizmo length={5} />
      <gridHelper args={[10, 10, "#44444a", "#2a2a2e"]} />

      <mesh position={ORIGIN}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={ORIGIN_COLOR} />
      </mesh>
      <Label3D text="Origin (0, 0, 0)" color={ORIGIN_COLOR} position={[0, -0.5, 0]} />

      <Line points={legX} color={AXIS_COLORS.x} dashed dashSize={0.15} gapSize={0.1} lineWidth={1.5} />
      <Line points={legY} color={AXIS_COLORS.y} dashed dashSize={0.15} gapSize={0.1} lineWidth={1.5} />
      <Line points={legZ} color={AXIS_COLORS.z} dashed dashSize={0.15} gapSize={0.1} lineWidth={1.5} />

      <DraggableObject position={position} onPositionChange={handlePositionChange} axis="xyz" gridSize={1}>
        <mesh>
          <sphereGeometry args={[0.22, 24, 24]} />
          <meshStandardMaterial
            color={atOrigin ? ORIGIN_COLOR : "#4f8ef7"}
            emissive={atOrigin ? ORIGIN_COLOR : "#000000"}
            emissiveIntensity={atOrigin ? 0.5 : 0}
          />
        </mesh>
      </DraggableObject>

      <Label3D text={`(${x}, ${y}, ${z})`} color={atOrigin ? ORIGIN_COLOR : "#ffffff"} position={[x, y + 0.5, z]} />
    </>
  );
}
