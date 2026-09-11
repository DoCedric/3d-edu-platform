"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Label3D } from "./Label3D";

interface AxisGizmoProps {
  origin?: [number, number, number];
  length?: number;
  showLabels?: boolean;
  colors?: { x?: string; y?: string; z?: string };
}

const DEFAULT_COLORS = { x: "#e5484d", y: "#30a46c", z: "#3b82f6" };

const X_DIR = new THREE.Vector3(1, 0, 0);
const Y_DIR = new THREE.Vector3(0, 1, 0);
const Z_DIR = new THREE.Vector3(0, 0, 1);

interface AxisArrowProps {
  direction: THREE.Vector3;
  length: number;
  color: string;
}

function AxisArrow({ direction, length, color }: AxisArrowProps) {
  const arrow = useMemo(
    () => new THREE.ArrowHelper(direction, new THREE.Vector3(0, 0, 0), length, new THREE.Color(color), length * 0.18, length * 0.1),
    [direction, length, color]
  );
  return <primitive object={arrow} />;
}

/** Generic X/Y/Z axis indicator, usable inside any scene plugin - carries no
 * knowledge of what it's placed next to. */
export function AxisGizmo({ origin = [0, 0, 0], length = 3, showLabels = true, colors }: AxisGizmoProps) {
  const resolved = { ...DEFAULT_COLORS, ...colors };

  return (
    <group position={origin}>
      <AxisArrow direction={X_DIR} length={length} color={resolved.x} />
      <AxisArrow direction={Y_DIR} length={length} color={resolved.y} />
      <AxisArrow direction={Z_DIR} length={length} color={resolved.z} />
      {showLabels && (
        <>
          <Label3D text="X" color={resolved.x} position={[length + 0.35, 0, 0]} />
          <Label3D text="Y" color={resolved.y} position={[0, length + 0.35, 0]} />
          <Label3D text="Z" color={resolved.z} position={[0, 0, length + 0.35]} />
        </>
      )}
    </group>
  );
}
