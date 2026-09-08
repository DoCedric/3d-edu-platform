"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, OrbitControlsProps } from "@react-three/drei";
import { ReactNode, useRef, useState } from "react";
import * as THREE from "three";
import { Button } from "@/components/ui/Button";
import { Toolbar } from "@/components/ui/Toolbar";
import { AnnotationHotspots } from "@/components/annotations/AnnotationHotspots";
import { SceneAnnotationSchema } from "@/lib/scenes/types";

interface ViewportProps {
  children: ReactNode;
  cameraPosition?: [number, number, number];
  annotations?: SceneAnnotationSchema[];
  selectedAnnotationId?: string | null;
  hoveredAnnotationId?: string | null;
  annotationFocusToken?: number;
  onAnnotationSelect?: (id: string | null) => void;
  onAnnotationHover?: (id: string | null) => void;
}

export function Viewport({
  children,
  cameraPosition = [3, 3, 3],
  annotations,
  selectedAnnotationId = null,
  hoveredAnnotationId = null,
  annotationFocusToken = 0,
  onAnnotationSelect,
  onAnnotationHover,
}: ViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleResetCamera = () => {
    controlsRef.current?.reset();
  };

  const handleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      el.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleScreenshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "scene-screenshot.png";
    link.click();
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-bg-elevated">
      <div className="absolute top-3 left-3 z-10">
        <Toolbar>
          <Button size="sm" variant="ghost" onClick={handleResetCamera}>
            Reset camera
          </Button>
          <Button size="sm" variant="ghost" onClick={handleFullscreen}>
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleScreenshot}>
            Screenshot
          </Button>
        </Toolbar>
      </div>

      <Canvas
        camera={{ position: cameraPosition, fov: 50 }}
        gl={{ preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          canvasRef.current = gl.domElement;
        }}
        onPointerMissed={() => onAnnotationSelect?.(null)}
      >
        <color attach="background" args={["#1a1a1d"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        {children}
        {annotations && annotations.length > 0 && (
          <AnnotationHotspots
            annotations={annotations}
            selectedId={selectedAnnotationId}
            hoveredId={hoveredAnnotationId}
            focusToken={annotationFocusToken}
            onSelect={onAnnotationSelect ?? (() => {})}
            onHover={onAnnotationHover ?? (() => {})}
          />
        )}
        <OrbitControls ref={controlsRef} makeDefault />
      </Canvas>
    </div>
  );
}
