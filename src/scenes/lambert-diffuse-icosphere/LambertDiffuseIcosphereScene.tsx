"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { DraggableObject } from "@/components/scene-kit/DraggableObject";
import { Label3D } from "@/components/scene-kit/Label3D";

export type Coordinate = [number, number, number];

const RADIUS = 1.3;
const DETAIL = 1;
// Both kinds of vector are drawn at this fixed length regardless of the
// light's actual distance, so 80-odd lines radiating off the sphere stay
// readable instead of turning into a tangle.
const LINE_LENGTH = 0.4;

const NORMAL_COLOR = "#58d6c2";
const LIGHT_COLOR = "#ffd166";
const UNLIT_COLOR = new THREE.Color("#7c9089");
const ANGLE_COLOR = "#ffffff";
// Kept low-poly relative to the single-triangle demo's arc (24 segments) -
// at this radius, on 80 faces at once, the extra smoothness wouldn't read.
const ANGLE_SEGMENTS = 10;
const ANGLE_RADIUS = 0.28;
const ANGLE_THETA_EPS = 0.03;

export const LIGHT_START: Coordinate = [3, 3, 2.5];

const rawGeometry = new THREE.IcosahedronGeometry(RADIUS, DETAIL);
const baseGeometry = rawGeometry.index ? rawGeometry.toNonIndexed() : rawGeometry;
const POSITIONS = baseGeometry.attributes.position.array as Float32Array;
const FACE_COUNT = POSITIONS.length / 9;

const FACE_CENTROIDS: THREE.Vector3[] = [];
const FACE_NORMALS: THREE.Vector3[] = [];
const FACE_NORMAL_ATTR = new Float32Array(POSITIONS.length);
const NORMAL_LINE_POSITIONS = new Float32Array(FACE_COUNT * 6);

for (let f = 0; f < FACE_COUNT; f++) {
  const base = f * 9;
  const v0 = new THREE.Vector3(POSITIONS[base], POSITIONS[base + 1], POSITIONS[base + 2]);
  const v1 = new THREE.Vector3(POSITIONS[base + 3], POSITIONS[base + 4], POSITIONS[base + 5]);
  const v2 = new THREE.Vector3(POSITIONS[base + 6], POSITIONS[base + 7], POSITIONS[base + 8]);

  const centroid = v0.clone().add(v1).add(v2).divideScalar(3);
  const normal = new THREE.Vector3().crossVectors(v1.clone().sub(v0), v2.clone().sub(v0)).normalize();
  if (normal.dot(centroid) < 0) normal.negate();

  FACE_CENTROIDS.push(centroid);
  FACE_NORMALS.push(normal);

  for (let k = 0; k < 3; k++) {
    FACE_NORMAL_ATTR[base + k * 3] = normal.x;
    FACE_NORMAL_ATTR[base + k * 3 + 1] = normal.y;
    FACE_NORMAL_ATTR[base + k * 3 + 2] = normal.z;
  }

  const tip = centroid.clone().addScaledVector(normal, LINE_LENGTH);
  const lineBase = f * 6;
  NORMAL_LINE_POSITIONS[lineBase] = centroid.x;
  NORMAL_LINE_POSITIONS[lineBase + 1] = centroid.y;
  NORMAL_LINE_POSITIONS[lineBase + 2] = centroid.z;
  NORMAL_LINE_POSITIONS[lineBase + 3] = tip.x;
  NORMAL_LINE_POSITIONS[lineBase + 4] = tip.y;
  NORMAL_LINE_POSITIONS[lineBase + 5] = tip.z;
}

interface LambertDiffuseIcosphereSceneProps {
  lightPosition: Coordinate;
  onLightPositionChange: (position: Coordinate) => void;
  showNormals: boolean;
  showLight: boolean;
  showLightVectors: boolean;
  showDiffuseColor: boolean;
}

/** Same Lambert diffuse principle as the single-triangle demo, but spread
 * across every face of an icosphere: one normal and one (fixed-length,
 * uncluttered) vector-to-light per face, each face's own cos(theta)
 * painted back on as grayscale when diffuse shading is enabled. */
export function LambertDiffuseIcosphereScene({
  lightPosition,
  onLightPositionChange,
  showNormals,
  showLight,
  showLightVectors,
  showDiffuseColor,
}: LambertDiffuseIcosphereSceneProps) {
  const lightVec = useMemo(() => new THREE.Vector3(...lightPosition), [lightPosition]);

  const lightVectorPositions = useMemo(() => {
    const arr = new Float32Array(FACE_COUNT * 6);
    for (let i = 0; i < FACE_COUNT; i++) {
      const dir = lightVec.clone().sub(FACE_CENTROIDS[i]).normalize();
      const tip = FACE_CENTROIDS[i].clone().addScaledVector(dir, LINE_LENGTH);
      const base = i * 6;
      arr[base] = FACE_CENTROIDS[i].x;
      arr[base + 1] = FACE_CENTROIDS[i].y;
      arr[base + 2] = FACE_CENTROIDS[i].z;
      arr[base + 3] = tip.x;
      arr[base + 4] = tip.y;
      arr[base + 5] = tip.z;
    }
    return arr;
  }, [lightVec]);

  const vertexColors = useMemo(() => {
    const arr = new Float32Array(FACE_COUNT * 9);
    for (let i = 0; i < FACE_COUNT; i++) {
      let r = UNLIT_COLOR.r;
      let g = UNLIT_COLOR.g;
      let b = UNLIT_COLOR.b;

      if (showDiffuseColor) {
        const dir = lightVec.clone().sub(FACE_CENTROIDS[i]).normalize();
        const cosine = THREE.MathUtils.clamp(FACE_NORMALS[i].dot(dir), -1, 1);
        const value = Math.max(0, cosine);
        r = g = b = value;
      }

      const base = i * 9;
      for (let k = 0; k < 3; k++) {
        arr[base + k * 3] = r;
        arr[base + k * 3 + 1] = g;
        arr[base + k * 3 + 2] = b;
      }
    }
    return arr;
  }, [lightVec, showDiffuseColor]);

  // One merged wedge mesh + one merged outline for all 80 faces, instead of
  // 160 separate scene objects - the angle indicator that's cheap regardless
  // of face count, since the GPU still only issues two draw calls for it.
  const { sectorGeometry, outlineGeometry } = useMemo(() => {
    const vertsPerFace = ANGLE_SEGMENTS + 2;
    const positions = new Float32Array(FACE_COUNT * vertsPerFace * 3);
    const outlinePositions = new Float32Array(FACE_COUNT * ANGLE_SEGMENTS * 6);
    const indices: number[] = [];

    for (let f = 0; f < FACE_COUNT; f++) {
      const origin = FACE_CENTROIDS[f];
      const normal = FACE_NORMALS[f];
      const dir = lightVec.clone().sub(origin).normalize();
      const theta = THREE.MathUtils.clamp(
        Math.acos(THREE.MathUtils.clamp(normal.dot(dir), -1, 1)),
        ANGLE_THETA_EPS,
        Math.PI - ANGLE_THETA_EPS
      );
      const sinTheta = Math.sin(theta);

      const vertBase = f * vertsPerFace * 3;
      positions[vertBase] = origin.x;
      positions[vertBase + 1] = origin.y;
      positions[vertBase + 2] = origin.z;

      const arcPoints: THREE.Vector3[] = [];
      for (let i = 0; i <= ANGLE_SEGMENTS; i++) {
        const t = i / ANGLE_SEGMENTS;
        const interp = normal
          .clone()
          .multiplyScalar(Math.sin((1 - t) * theta))
          .add(dir.clone().multiplyScalar(Math.sin(t * theta)))
          .multiplyScalar(1 / sinTheta);
        const point = origin.clone().addScaledVector(interp, ANGLE_RADIUS);
        arcPoints.push(point);

        const idx = vertBase + (i + 1) * 3;
        positions[idx] = point.x;
        positions[idx + 1] = point.y;
        positions[idx + 2] = point.z;
      }

      const originIndex = f * vertsPerFace;
      for (let i = 1; i <= ANGLE_SEGMENTS; i++) {
        indices.push(originIndex, originIndex + i, originIndex + i + 1);
      }

      const outlineBase = f * ANGLE_SEGMENTS * 6;
      for (let i = 0; i < ANGLE_SEGMENTS; i++) {
        const p0 = arcPoints[i];
        const p1 = arcPoints[i + 1];
        const off = outlineBase + i * 6;
        outlinePositions[off] = p0.x;
        outlinePositions[off + 1] = p0.y;
        outlinePositions[off + 2] = p0.z;
        outlinePositions[off + 3] = p1.x;
        outlinePositions[off + 4] = p1.y;
        outlinePositions[off + 5] = p1.z;
      }
    }

    const sectorGeom = new THREE.BufferGeometry();
    sectorGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    sectorGeom.setIndex(indices);
    sectorGeom.computeVertexNormals();

    const outlineGeom = new THREE.BufferGeometry();
    outlineGeom.setAttribute("position", new THREE.BufferAttribute(outlinePositions, 3));

    return { sectorGeometry: sectorGeom, outlineGeometry: outlineGeom };
  }, [lightVec]);

  return (
    <>
      <mesh>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[POSITIONS, 3]} />
          <bufferAttribute attach="attributes-normal" args={[FACE_NORMAL_ATTR, 3]} />
          <bufferAttribute attach="attributes-color" args={[vertexColors, 3]} />
        </bufferGeometry>
        <meshStandardMaterial vertexColors roughness={0.7} side={THREE.DoubleSide} />
      </mesh>

      {showNormals && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[NORMAL_LINE_POSITIONS, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={NORMAL_COLOR} />
        </lineSegments>
      )}

      {showLightVectors && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[lightVectorPositions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={LIGHT_COLOR} />
        </lineSegments>
      )}

      {showNormals && showLightVectors && (
        <>
          <mesh geometry={sectorGeometry}>
            <meshBasicMaterial color={ANGLE_COLOR} transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <lineSegments geometry={outlineGeometry}>
            <lineBasicMaterial color={ANGLE_COLOR} transparent opacity={0.45} />
          </lineSegments>
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
    </>
  );
}
