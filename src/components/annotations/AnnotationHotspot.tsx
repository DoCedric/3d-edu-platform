"use client";

import { ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { SceneAnnotationSchema } from "@/lib/scenes/types";

interface AnnotationHotspotProps {
  annotation: SceneAnnotationSchema;
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

export function AnnotationHotspot({ annotation, selected, hovered, onSelect, onHover }: AnnotationHotspotProps) {
  const active = selected || hovered;
  const color = selected ? "#ffb020" : "#4f8ef7";

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(annotation.id);
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(null);
    document.body.style.cursor = "auto";
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(annotation.id);
  };

  return (
    <group position={annotation.position}>
      <mesh onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} onClick={handleClick}>
        <sphereGeometry args={[active ? 0.09 : 0.07, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh scale={active ? 1.8 : 1.4}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.35 : 0.18} depthWrite={false} />
      </mesh>
      {active && (
        <Html distanceFactor={8} position={[0, 0.22, 0]} center style={{ pointerEvents: "none" }}>
          <div
            className={`px-2 py-1 rounded-sm border text-xs whitespace-nowrap shadow ${
              selected ? "bg-accent text-accent-foreground border-accent" : "bg-bg-elevated text-text border-border"
            }`}
          >
            {annotation.label}
          </div>
        </Html>
      )}
    </group>
  );
}
