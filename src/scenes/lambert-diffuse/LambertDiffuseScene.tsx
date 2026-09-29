"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { DraggableObject } from "@/components/scene-kit/DraggableObject";
import { Label3D } from "@/components/scene-kit/Label3D";

export type Coordinate = [number, number, number];

export const TRIANGLE_VERTICES: [Coordinate, Coordinate, Coordinate] = [
  [-1.3, -0.3, 0.5],
  [1.2, -0.6, -0.4],
  [-0.1, 0.8, -0.5],
];

const [V0, V1, V2] = TRIANGLE_VERTICES.map((v) => new THREE.Vector3(...v));
const CENTROID_VEC = V0.clone().add(V1).add(V2).divideScalar(3);
const NORMAL_VEC = new THREE.Vector3().crossVectors(V1.clone().sub(V0), V2.clone().sub(V0)).normalize();

export const TRIANGLE_CENTROID: Coordinate = [CENTROID_VEC.x, CENTROID_VEC.y, CENTROID_VEC.z];
export const TRIANGLE_NORMAL: Coordinate = [NORMAL_VEC.x, NORMAL_VEC.y, NORMAL_VEC.z];
export const LIGHT_START: Coordinate = [1.4, 1.8, 1.3];

const NORMAL_COLOR = "#58d6c2";
const LIGHT_COLOR = "#ffd166";
const UNLIT_COLOR = "#7c9089";
const SECTOR_FILL = "#ffffff";

/** cos(theta) between the fixed face normal and the vector from the
 * triangle's centroid to the light. Single source of truth so the 3D scene
 * and the HTML formula/gradient overlay never compute this differently. */
export function computeCosine(lightPosition: Coordinate): number {
  const lightDir = new THREE.Vector3(...lightPosition).sub(CENTROID_VEC).normalize();
  return THREE.MathUtils.clamp(NORMAL_VEC.dot(lightDir), -1, 1);
}

interface VectorArrowProps {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  length: number;
  color: string;
}

function VectorArrow({ origin, direction, length, color }: VectorArrowProps) {
  const arrow = useMemo(
    () => new THREE.ArrowHelper(direction, origin, length, new THREE.Color(color), length * 0.22, length * 0.12),
    [origin, direction, length, color]
  );
  return <primitive object={arrow} />;
}

interface AngleSectorProps {
  origin: THREE.Vector3;
  from: THREE.Vector3;
  to: THREE.Vector3;
  radius: number;
}

/** Filled wedge + outline tracing the angle between two unit vectors that
 * share an origin, built by slerping between them - the "typical display"
 * used in lighting diagrams to call out theta between a normal and a
 * light direction. */
function AngleSector({ origin, from, to, radius }: AngleSectorProps) {
  const theta = Math.acos(THREE.MathUtils.clamp(from.dot(to), -1, 1));

  const { geometry, outline } = useMemo(() => {
    if (theta < 0.03 || theta > Math.PI - 0.03) return { geometry: null, outline: null };

    const segments = 24;
    const sinTheta = Math.sin(theta);
    const arcPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const dir = from
        .clone()
        .multiplyScalar(Math.sin((1 - t) * theta))
        .add(to.clone().multiplyScalar(Math.sin(t * theta)))
        .multiplyScalar(1 / sinTheta);
      arcPoints.push(origin.clone().add(dir.multiplyScalar(radius)));
    }

    const positions: number[] = [origin.x, origin.y, origin.z];
    arcPoints.forEach((p) => positions.push(p.x, p.y, p.z));

    const indices: number[] = [];
    for (let i = 1; i <= segments; i++) indices.push(0, i, i + 1);

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    return { geometry: geom, outline: [origin, ...arcPoints, origin] as THREE.Vector3[] };
  }, [origin, from, to, radius, theta]);

  if (!geometry || !outline) return null;

  return (
    <>
      <mesh geometry={geometry}>
        <meshBasicMaterial color={SECTOR_FILL} transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Line points={outline} color={SECTOR_FILL} transparent opacity={0.55} lineWidth={1.5} />
    </>
  );
}

interface LambertDiffuseSceneProps {
  lightPosition: Coordinate;
  onLightPositionChange: (position: Coordinate) => void;
  showNormal: boolean;
  showLight: boolean;
  showLightVector: boolean;
  showDiffuseColor: boolean;
}

/** A single fixed triangle lit by a draggable, symbolic (non-rendering)
 * light. Shows the pieces of the Lambert diffuse term one at a time: the
 * face normal, the vector to the light, the angle between them, and the
 * resulting cos(theta) painted back onto the surface as grayscale. */
export function LambertDiffuseScene({
  lightPosition,
  onLightPositionChange,
  showNormal,
  showLight,
  showLightVector,
  showDiffuseColor,
}: LambertDiffuseSceneProps) {
  const lightVec = useMemo(() => new THREE.Vector3(...lightPosition), [lightPosition]);
  const lightDir = useMemo(() => lightVec.clone().sub(CENTROID_VEC).normalize(), [lightVec]);
  const lightDistance = useMemo(() => CENTROID_VEC.distanceTo(lightVec), [lightVec]);
  const cosine = useMemo(() => computeCosine(lightPosition), [lightPosition]);
  const clampedCosine = Math.max(0, cosine);

  const triangleColor = showDiffuseColor
    ? new THREE.Color(clampedCosine, clampedCosine, clampedCosine)
    : new THREE.Color(UNLIT_COLOR);

  const trianglePositions = useMemo(
    () => new Float32Array([...TRIANGLE_VERTICES[0], ...TRIANGLE_VERTICES[1], ...TRIANGLE_VERTICES[2]]),
    []
  );
  const triangleNormals = useMemo(
    () => new Float32Array([...TRIANGLE_NORMAL, ...TRIANGLE_NORMAL, ...TRIANGLE_NORMAL]),
    []
  );

  return (
    <>
      <mesh>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trianglePositions, 3]} />
          <bufferAttribute attach="attributes-normal" args={[triangleNormals, 3]} />
        </bufferGeometry>
        <meshStandardMaterial color={triangleColor} side={THREE.DoubleSide} roughness={0.7} />
      </mesh>

      <mesh position={CENTROID_VEC}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color="#dfe8e4" />
      </mesh>

      {showNormal && (
        <>
          <VectorArrow origin={CENTROID_VEC} direction={NORMAL_VEC} length={1.5} color={NORMAL_COLOR} />
          <Label3D text="N" color={NORMAL_COLOR} position={CENTROID_VEC.clone().addScaledVector(NORMAL_VEC, 1.7).toArray()} size={0.35} />
        </>
      )}

      {showLight && (
        <DraggableObject position={lightPosition} onPositionChange={onLightPositionChange} gridSize={0}>
          <mesh>
            <sphereGeometry args={[0.18, 20, 20]} />
            <meshStandardMaterial color={LIGHT_COLOR} emissive={LIGHT_COLOR} emissiveIntensity={0.8} />
          </mesh>
          <Label3D text="Light" color={LIGHT_COLOR} position={[0, 0.4, 0]} size={0.3} />
        </DraggableObject>
      )}

      {showLightVector && (
        <>
          <VectorArrow origin={CENTROID_VEC} direction={lightDir} length={lightDistance} color={LIGHT_COLOR} />
          <Label3D
            text="L"
            color={LIGHT_COLOR}
            position={CENTROID_VEC.clone().addScaledVector(lightDir, lightDistance * 0.55).toArray()}
            size={0.35}
          />
        </>
      )}

      {showNormal && showLightVector && (
        <AngleSector origin={CENTROID_VEC} from={NORMAL_VEC} to={lightDir} radius={Math.min(0.9, lightDistance * 0.5)} />
      )}
    </>
  );
}
