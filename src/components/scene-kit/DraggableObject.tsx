"use client";

import { ReactNode, useCallback, useMemo, useRef } from "react";
import { ThreeEvent, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

export type DragAxis = "x" | "y" | "z" | "xy" | "xz" | "yz" | "xyz";

const AXIS_VECTORS: Record<DragAxis, THREE.Vector3[]> = {
  x: [new THREE.Vector3(1, 0, 0)],
  y: [new THREE.Vector3(0, 1, 0)],
  z: [new THREE.Vector3(0, 0, 1)],
  xy: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)],
  xz: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)],
  yz: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)],
  xyz: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)],
};

function snap(value: number, gridSize: number): number {
  if (gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

interface DraggableObjectProps {
  /** Current position, owned by the caller (this component is controlled, like an input). */
  position: [number, number, number];
  onPositionChange: (position: [number, number, number]) => void;
  /** Which axis/axes the drag is constrained to. */
  axis?: DragAxis;
  /** Grid increment the position snaps to while dragging. */
  gridSize?: number;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  children: ReactNode;
}

/** Generic drag-and-snap mechanism for any R3F object. Knows nothing about
 * what it's dragging (a cube, a light, anything) - it just reports a new
 * controlled position, constrained to an axis/plane and snapped to a grid.
 * Disables the active OrbitControls while dragging so camera orbit and
 * object drag never fight over the same pointer gesture. */
export function DraggableObject({
  position,
  onPositionChange,
  axis = "xyz",
  gridSize = 1,
  onDragStart,
  onDragEnd,
  children,
}: DraggableObjectProps) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null;

  const axisVectors = useMemo(() => AXIS_VECTORS[axis], [axis]);
  const dragPlane = useRef(new THREE.Plane());
  const dragState = useRef<{ startPointer: THREE.Vector3; startPosition: THREE.Vector3 } | null>(null);

  const projectOntoAxes = useCallback(
    (delta: THREE.Vector3) => {
      const projected = new THREE.Vector3();
      for (const axisVec of axisVectors) {
        projected.addScaledVector(axisVec, delta.dot(axisVec));
      }
      return projected;
    },
    [axisVectors]
  );

  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      (event.target as Element).setPointerCapture(event.pointerId);
      if (controls) controls.enabled = false;
      document.body.style.cursor = "grabbing";

      const origin = new THREE.Vector3(...position);
      const normal = camera.getWorldDirection(new THREE.Vector3());
      dragPlane.current.setFromNormalAndCoplanarPoint(normal, origin);

      const hitPoint = new THREE.Vector3();
      event.ray.intersectPlane(dragPlane.current, hitPoint);

      dragState.current = { startPointer: hitPoint, startPosition: origin };
      onDragStart?.();
    },
    [camera, controls, position, onDragStart]
  );

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!dragState.current) return;

      const hitPoint = new THREE.Vector3();
      const hit = event.ray.intersectPlane(dragPlane.current, hitPoint);
      if (!hit) return;

      const delta = projectOntoAxes(hitPoint.clone().sub(dragState.current.startPointer));
      const nextPosition = dragState.current.startPosition.clone().add(delta);

      onPositionChange([snap(nextPosition.x, gridSize), snap(nextPosition.y, gridSize), snap(nextPosition.z, gridSize)]);
    },
    [projectOntoAxes, gridSize, onPositionChange]
  );

  const handlePointerUp = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!dragState.current) return;
      dragState.current = null;
      (event.target as Element).releasePointerCapture(event.pointerId);
      if (controls) controls.enabled = true;
      document.body.style.cursor = "auto";
      onDragEnd?.();
    },
    [controls, onDragEnd]
  );

  const handlePointerOver = useCallback(() => {
    if (!dragState.current) document.body.style.cursor = "grab";
  }, []);

  const handlePointerOut = useCallback(() => {
    if (!dragState.current) document.body.style.cursor = "auto";
  }, []);

  return (
    <group
      position={position}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {children}
    </group>
  );
}
