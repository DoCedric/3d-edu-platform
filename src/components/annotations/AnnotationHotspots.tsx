"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { SceneAnnotationSchema } from "@/lib/scenes/types";
import { AnnotationHotspot } from "./AnnotationHotspot";

interface AnnotationHotspotsProps {
  annotations: SceneAnnotationSchema[];
  selectedId: string | null;
  hoveredId: string | null;
  focusToken?: number;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

const FOCUS_DISTANCE = 3;
const FOCUS_LERP = 0.08;
const FOCUS_EPSILON = 0.01;

export function AnnotationHotspots({
  annotations,
  selectedId,
  hoveredId,
  focusToken,
  onSelect,
  onHover,
}: AnnotationHotspotsProps) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null;

  const focusTarget = useRef<THREE.Vector3 | null>(null);
  const focusCameraPos = useRef<THREE.Vector3 | null>(null);

  // Re-runs on every (re)selection via focusToken, so clicking an already-selected
  // annotation again re-triggers the focus animation instead of being a no-op.
  useEffect(() => {
    if (!selectedId || !controls) return;
    const annotation = annotations.find((a) => a.id === selectedId);
    if (!annotation) return;

    const targetPos = new THREE.Vector3(...annotation.position);
    const direction = camera.position.clone().sub(controls.target);
    if (direction.lengthSq() < 1e-6) direction.set(0, 0, 1);
    direction.normalize().multiplyScalar(FOCUS_DISTANCE);

    focusTarget.current = targetPos;
    focusCameraPos.current = targetPos.clone().add(direction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken]);

  // Deselecting (background click, or switching scenes) cancels any in-flight focus.
  useEffect(() => {
    if (selectedId === null) {
      focusTarget.current = null;
      focusCameraPos.current = null;
    }
  }, [selectedId]);

  useEffect(() => {
    if (!controls) return;

    const cancelFocus = () => {
      focusTarget.current = null;
      focusCameraPos.current = null;
    };

    controls.addEventListener("start", cancelFocus);
    return () => controls.removeEventListener("start", cancelFocus);
  }, [controls]);

  useFrame(() => {
    if (!controls || !focusTarget.current || !focusCameraPos.current) return;

    controls.target.lerp(focusTarget.current, FOCUS_LERP);
    camera.position.lerp(focusCameraPos.current, FOCUS_LERP);
    controls.update();

    const targetReached = controls.target.distanceTo(focusTarget.current) < FOCUS_EPSILON;
    const cameraReached = camera.position.distanceTo(focusCameraPos.current) < FOCUS_EPSILON;
    if (targetReached && cameraReached) {
      focusTarget.current = null;
      focusCameraPos.current = null;
    }
  });

  return (
    <>
      {annotations.map((annotation) => (
        <AnnotationHotspot
          key={annotation.id}
          annotation={annotation}
          selected={annotation.id === selectedId}
          hovered={annotation.id === hoveredId}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </>
  );
}
