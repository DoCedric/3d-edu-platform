"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import * as THREE from "three";

export interface TriangleAnatomyVisibility {
  vertices: boolean;
  edges: boolean;
  faces: boolean;
}

const TRIANGLE_VERTICES: [number, number, number][] = [
  [-1.6, -1.1, 0],
  [1.6, -1.1, 0],
  [0, 1.4, 0],
];

export const VERTEX_COLOR = "#f5a623";
export const EDGE_COLOR = "#38bdf8";
export const FACE_COLOR = "#34d399";

interface TriangleAnatomySceneProps {
  visibility: TriangleAnatomyVisibility;
}

/** Renders a single triangle's three structural parts independently, so a
 * learner can toggle each on to build up how a mesh is composed: vertices
 * (points) -> edges (the lines between them) -> faces (the surface they
 * enclose). No axes or grid - the triangle is the whole scene. */
export function TriangleAnatomyScene({ visibility }: TriangleAnatomySceneProps) {
  const faceGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(TRIANGLE_VERTICES.flat());
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  const edgeLoop = useMemo(() => [...TRIANGLE_VERTICES, TRIANGLE_VERTICES[0]] as [number, number, number][], []);

  return (
    <>
      {visibility.faces && (
        <mesh geometry={faceGeometry}>
          <meshStandardMaterial color={FACE_COLOR} side={THREE.DoubleSide} transparent opacity={0.55} />
        </mesh>
      )}

      {visibility.edges && <Line points={edgeLoop} color={EDGE_COLOR} lineWidth={3} />}

      {visibility.vertices &&
        TRIANGLE_VERTICES.map((position, index) => (
          <mesh key={index} position={position}>
            <sphereGeometry args={[0.1, 20, 20]} />
            <meshStandardMaterial color={VERTEX_COLOR} />
          </mesh>
        ))}
    </>
  );
}
