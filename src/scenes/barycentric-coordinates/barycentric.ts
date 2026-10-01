import * as THREE from "three";

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
/** [wA, wB, wC] - weights of the three triangle vertices, summing to 1. */
export type Bary = [number, number, number];

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _p = new THREE.Vector3();
const _target = new THREE.Vector3();

function toVector3(point: Vec2 | Vec3, target: THREE.Vector3): THREE.Vector3 {
  return point.length === 3 ? target.set(point[0], point[1], point[2]) : target.set(point[0], point[1], 0);
}

/** Barycentric weights of `point` relative to triangle (a,b,c) - the single
 * source of truth for both directions of this demo: a real 3D point against
 * the 3D vertex positions, or a flat (u,v) point against the UV triangle. */
export function computeBarycentric(
  point: Vec2 | Vec3,
  a: Vec2 | Vec3,
  b: Vec2 | Vec3,
  c: Vec2 | Vec3
): Bary | null {
  const result = THREE.Triangle.getBarycoord(
    toVector3(point, _p),
    toVector3(a, _a),
    toVector3(b, _b),
    toVector3(c, _c),
    _target
  );
  return result ? [_target.x, _target.y, _target.z] : null;
}

/** All three weights non-negative (within float slack) means the point lies inside/on the triangle. */
export function isInsideTriangle(bary: Bary, epsilon = 1e-4): boolean {
  return bary[0] >= -epsilon && bary[1] >= -epsilon && bary[2] >= -epsilon;
}

export function lerpVec3(bary: Bary, a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const [wA, wB, wC] = bary;
  return [
    wA * a[0] + wB * b[0] + wC * c[0],
    wA * a[1] + wB * b[1] + wC * c[1],
    wA * a[2] + wB * b[2] + wC * c[2],
  ];
}

export function lerpVec2(bary: Bary, a: Vec2, b: Vec2, c: Vec2): Vec2 {
  const [wA, wB, wC] = bary;
  return [wA * a[0] + wB * b[0] + wC * c[0], wA * a[1] + wB * b[1] + wC * c[1]];
}
