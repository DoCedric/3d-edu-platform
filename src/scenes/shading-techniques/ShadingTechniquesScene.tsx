"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DraggableObject } from "@/components/scene-kit/DraggableObject";
import { Label3D } from "@/components/scene-kit/Label3D";

export type ShadingMode = "flat" | "gouraud" | "phong";
export type Coordinate = [number, number, number];

export const LIGHT_START: Coordinate = [2.3, 1.9, 2.1];
export const SPHERE_RADIUS = 1.3;

// Deliberately chunky (not round-looking at a glance) - flat facets and the
// Gouraud interpolation artifact are only visible at a low segment count.
// At a high segment count all three modes would look nearly identical.
const WIDTH_SEGMENTS = 14;
const HEIGHT_SEGMENTS = 10;

const BASE_COLOR = new THREE.Color("#4f91d6");
const SHININESS = 60;
const LIGHT_INTENSITY = 1.1;
// Matched to the scene's real ambientLight/pointLight values below so the
// hand-computed Gouraud path and the GPU-lit flat/Phong paths land at
// comparable brightness - differences between the three should come from the
// shading technique, not from an accidental mismatch in the light math.
const AMBIENT = 0.12;
const DIFFUSE_WEIGHT = LIGHT_INTENSITY;

// Scratch objects reused every frame/vertex so Gouraud shading doesn't
// allocate a fresh Vector3/Color per vertex per frame.
const _lightPos = new THREE.Vector3();
const _vertexPos = new THREE.Vector3();
const _vertexNormal = new THREE.Vector3();
const _lightDir = new THREE.Vector3();
const _viewDir = new THREE.Vector3();
const _halfVec = new THREE.Vector3();
const _litColor = new THREE.Color();

/** Flat and Phong (smooth) modes are just the GPU's own MeshPhongMaterial:
 * `flatShading` toggles between it deriving a hard per-facet normal (flat)
 * or using the geometry's smooth per-vertex normals interpolated per pixel
 * (Phong) - both light every pixel in the fragment shader, which is exactly
 * what makes Phong's highlight glide smoothly despite the low-poly mesh. */
function LitSphere({ shadingMode }: { shadingMode: "flat" | "phong" }) {
  return (
    <mesh>
      <sphereGeometry args={[SPHERE_RADIUS, WIDTH_SEGMENTS, HEIGHT_SEGMENTS]} />
      {/* keyed on shadingMode: flatShading changes which shader variant the
       * material compiles to, and R3F only assigns it as a plain property on
       * the existing material instance - without a fresh instance the GPU
       * keeps running the old (already-compiled) shader, so flat<->phong
       * wouldn't visibly update without forcing a remount here. */}
      <meshPhongMaterial key={shadingMode} color={BASE_COLOR} specular="#ffffff" shininess={SHININESS} flatShading={shadingMode === "flat"} />
    </mesh>
  );
}

/** Classic Gouraud shading: light is evaluated only at each vertex (same
 * Blinn-Phong formula and shininess as the GPU materials above, for a fair
 * comparison), baked into a `color` attribute, and rendered unlit - the GPU
 * then does nothing but linearly interpolate that color across each
 * triangle. Recomputed every frame (not memoized) since both the dragged
 * light and the orbiting camera's view direction affect the result, exactly
 * like a real fixed-function Gouraud pipeline would. */
function GouraudSphere({ lightPosition }: { lightPosition: Coordinate }) {
  const geometryRef = useRef<THREE.SphereGeometry>(null);

  useEffect(() => {
    const geometry = geometryRef.current;
    if (!geometry) return;
    const count = geometry.attributes.position.count;
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  }, []);

  useFrame((state) => {
    const geometry = geometryRef.current;
    const colorAttr = geometry?.attributes.color as THREE.BufferAttribute | undefined;
    if (!geometry || !colorAttr) return;

    const positionAttr = geometry.attributes.position;
    const normalAttr = geometry.attributes.normal;
    _lightPos.set(lightPosition[0], lightPosition[1], lightPosition[2]);

    for (let i = 0; i < positionAttr.count; i++) {
      _vertexPos.fromBufferAttribute(positionAttr, i);
      _vertexNormal.fromBufferAttribute(normalAttr, i);
      _lightDir.copy(_lightPos).sub(_vertexPos).normalize();
      _viewDir.copy(state.camera.position).sub(_vertexPos).normalize();
      _halfVec.copy(_lightDir).add(_viewDir).normalize();

      const diffuse = Math.max(_vertexNormal.dot(_lightDir), 0);
      const specular = Math.pow(Math.max(_vertexNormal.dot(_halfVec), 0), SHININESS);

      _litColor.copy(BASE_COLOR).multiplyScalar(AMBIENT + DIFFUSE_WEIGHT * diffuse);
      colorAttr.setXYZ(i, Math.min(1, _litColor.r + specular), Math.min(1, _litColor.g + specular), Math.min(1, _litColor.b + specular));
    }
    // Mutating the geometry's buffer attribute in place (rather than
    // allocating a new one every frame) is the standard three.js way to
    // update per-vertex data each frame; there's no non-mutating equivalent.
    // eslint-disable-next-line react-hooks/immutability
    colorAttr.needsUpdate = true;
  });

  return (
    <mesh>
      <sphereGeometry ref={geometryRef} args={[SPHERE_RADIUS, WIDTH_SEGMENTS, HEIGHT_SEGMENTS]} />
      <meshBasicMaterial vertexColors />
    </mesh>
  );
}

interface ShadingTechniquesSceneProps {
  shadingMode: ShadingMode;
  lightPosition: Coordinate;
  onLightPositionChange: (position: Coordinate) => void;
}

/** A single low-poly sphere whose material swaps between three real-time
 * shading techniques, lit by one draggable point light so a student can drag
 * the "hot spot" around and watch each technique handle it differently:
 * flat shading snaps between large faceted highlights, Gouraud shading can
 * miss or smear a tight highlight that falls inside a triangle rather than
 * on a vertex, and Phong shading keeps it smooth and round throughout. */
export function ShadingTechniquesScene({ shadingMode, lightPosition, onLightPositionChange }: ShadingTechniquesSceneProps) {
  return (
    <>
      {/* decay=0: a plain, distance-independent light, matching the Gouraud
       * path's math below (which has no falloff term) - the default
       * physically-based inverse-square decay would otherwise make the
       * GPU-lit modes much dimmer than Gouraud at this light's distance. */}
      <pointLight position={lightPosition} intensity={LIGHT_INTENSITY} decay={0} />

      {shadingMode === "gouraud" ? (
        <GouraudSphere lightPosition={lightPosition} />
      ) : (
        <LitSphere shadingMode={shadingMode} />
      )}

      <DraggableObject position={lightPosition} onPositionChange={onLightPositionChange} gridSize={0}>
        <mesh>
          <sphereGeometry args={[0.12, 20, 20]} />
          <meshBasicMaterial color="#ffd166" />
        </mesh>
        <Label3D text="Light" color="#ffd166" position={[0, 0.32, 0]} size={0.3} />
      </DraggableObject>
    </>
  );
}
