/**
 * Software rasterizer for the "Rasterization pipeline" demo.
 *
 * Every stage of the real-time pipeline is a pure function that takes the
 * previous stage's output and returns its own, so the UI can show the real
 * intermediate data of any step:
 *
 *   vertexStage -> cullStage -> rasterStage -> fragmentStage -> depthStage
 *
 * Only three.js math types are used (no DOM, no WebGL). The scene camera's
 * view and projection matrices come straight from the THREE.PerspectiveCamera
 * that the world view draws as a frustum, so both views always agree.
 *
 * Conventions: screen x runs right and y runs DOWN in pixels, pixel (x, y)
 * covers [x, x + 1] x [y, y + 1] and is sampled at its centre. Depth is the
 * NDC z mapped to 0 (near plane) .. 1 (far plane), like a GPU depth buffer.
 */

import * as THREE from "three";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface MeshData {
  /** Model-space positions, xyz per vertex. */
  positions: Float32Array;
  /** Model-space smooth vertex normals, xyz per vertex. */
  normals: Float32Array;
  /** Three vertex indices per triangle, counter-clockwise = front face. */
  indices: Uint32Array;
  vertexCount: number;
  triangleCount: number;
}

export interface Resolution {
  width: number;
  height: number;
}

export interface Transforms {
  model: THREE.Matrix4;
  view: THREE.Matrix4;
  projection: THREE.Matrix4;
  cameraPosition: THREE.Vector3;
}

// ---------------------------------------------------------------------------
// 1. Vertex stage: model -> world -> view -> clip -> NDC -> screen
// ---------------------------------------------------------------------------

export interface VertexOutput {
  world: Float32Array; // 3 per vertex
  view: Float32Array; // 3 per vertex
  clip: Float32Array; // 4 per vertex
  ndc: Float32Array; // 3 per vertex
  /** x, y in pixels (y down) and depth 0..1. */
  screen: Float32Array; // 3 per vertex
  worldNormal: Float32Array; // 3 per vertex
}

export function vertexStage(mesh: MeshData, t: Transforms, res: Resolution): VertexOutput {
  const n = mesh.vertexCount;
  const out: VertexOutput = {
    world: new Float32Array(n * 3),
    view: new Float32Array(n * 3),
    clip: new Float32Array(n * 4),
    ndc: new Float32Array(n * 3),
    screen: new Float32Array(n * 3),
    worldNormal: new Float32Array(n * 3),
  };
  const m = t.model.elements;
  const v = t.view.elements;
  const p = t.projection.elements;
  const nm = new THREE.Matrix3().getNormalMatrix(t.model).elements;
  const P = mesh.positions;
  const N = mesh.normals;

  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    // Model matrix
    const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
    // View matrix
    const vx = v[0] * wx + v[4] * wy + v[8] * wz + v[12];
    const vy = v[1] * wx + v[5] * wy + v[9] * wz + v[13];
    const vz = v[2] * wx + v[6] * wy + v[10] * wz + v[14];
    // Projection matrix
    const cx = p[0] * vx + p[4] * vy + p[8] * vz + p[12];
    const cy = p[1] * vx + p[5] * vy + p[9] * vz + p[13];
    const cz = p[2] * vx + p[6] * vy + p[10] * vz + p[14];
    const cw = p[3] * vx + p[7] * vy + p[11] * vz + p[15];
    // Perspective divide
    const iw = 1 / cw;
    const nx = cx * iw, ny = cy * iw, nz = cz * iw;

    out.world.set([wx, wy, wz], i * 3);
    out.view.set([vx, vy, vz], i * 3);
    out.clip.set([cx, cy, cz, cw], i * 4);
    out.ndc.set([nx, ny, nz], i * 3);
    // Viewport transform
    out.screen.set([((nx + 1) / 2) * res.width, ((1 - ny) / 2) * res.height, (nz + 1) / 2], i * 3);

    const ax = N[i * 3], ay = N[i * 3 + 1], az = N[i * 3 + 2];
    const nwx = nm[0] * ax + nm[3] * ay + nm[6] * az;
    const nwy = nm[1] * ax + nm[4] * ay + nm[7] * az;
    const nwz = nm[2] * ax + nm[5] * ay + nm[8] * az;
    const len = Math.hypot(nwx, nwy, nwz) || 1;
    out.worldNormal.set([nwx / len, nwy / len, nwz / len], i * 3);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. Cull stage: frustum culling and back-face culling
// ---------------------------------------------------------------------------

export const TRI_VISIBLE = 0;
export const TRI_BACK = 1;
export const TRI_OUTSIDE = 2;

export interface CullOutput {
  /** TRI_VISIBLE, TRI_BACK or TRI_OUTSIDE per triangle. */
  status: Uint8Array;
  /** Indices of the surviving triangles, in mesh order. */
  visible: Uint32Array;
}

export function cullStage(mesh: MeshData, vtx: VertexOutput, options: { backFaceCulling: boolean }): CullOutput {
  const status = new Uint8Array(mesh.triangleCount);
  const visible: number[] = [];
  const I = mesh.indices;
  const C = vtx.clip;
  const D = vtx.ndc;

  for (let t = 0; t < mesh.triangleCount; t++) {
    const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];

    // Frustum: outside if all three corners are beyond the same clip plane
    // (-w <= x, y, z <= w). Triangles that reach behind the eye are dropped
    // too; a real GPU would clip (cut) them at the near plane instead.
    let outside = false;
    if (C[a * 4 + 3] <= 1e-6 || C[b * 4 + 3] <= 1e-6 || C[c * 4 + 3] <= 1e-6) outside = true;
    for (let axis = 0; axis < 3 && !outside; axis++) {
      let above = 0, below = 0;
      for (const i of [a, b, c]) {
        const value = C[i * 4 + axis], w = C[i * 4 + 3];
        if (value > w) above++;
        if (value < -w) below++;
      }
      outside = above === 3 || below === 3;
    }
    if (outside) {
      status[t] = TRI_OUTSIDE;
      continue;
    }

    // Back face: the corners appear clockwise on screen (signed area <= 0 in NDC, y up).
    if (options.backFaceCulling) {
      const area = (D[b * 3] - D[a * 3]) * (D[c * 3 + 1] - D[a * 3 + 1]) - (D[c * 3] - D[a * 3]) * (D[b * 3 + 1] - D[a * 3 + 1]);
      if (area <= 0) {
        status[t] = TRI_BACK;
        continue;
      }
    }
    visible.push(t);
  }
  return { status, visible: Uint32Array.from(visible) };
}

// ---------------------------------------------------------------------------
// 3. Raster stage: which pixel centres does each triangle cover?
// ---------------------------------------------------------------------------

export interface RasterOutput {
  count: number;
  tri: Int32Array;
  x: Uint16Array;
  y: Uint16Array;
  /** Depth 0..1, interpolated linearly in screen space (as NDC z is). */
  z: Float32Array;
  /** Perspective-correct barycentric weights of the triangle's corners. */
  b0: Float32Array;
  b1: Float32Array;
  b2: Float32Array;
  /** Fragments of visible[k] are start[k] .. start[k + 1] - 1. */
  start: Uint32Array;
}

class FragmentBuffer {
  count = 0;
  tri = new Int32Array(0);
  x = new Uint16Array(0);
  y = new Uint16Array(0);
  z = new Float32Array(0);
  b0 = new Float32Array(0);
  b1 = new Float32Array(0);
  b2 = new Float32Array(0);

  constructor(capacity: number) {
    this.resize(capacity);
  }

  private resize(capacity: number) {
    const grow = <T extends Int32Array | Uint16Array | Float32Array>(old: T, make: (n: number) => T) => {
      const next = make(capacity);
      next.set(old.subarray(0, this.count));
      return next;
    };
    this.tri = grow(this.tri, (n) => new Int32Array(n));
    this.x = grow(this.x, (n) => new Uint16Array(n));
    this.y = grow(this.y, (n) => new Uint16Array(n));
    this.z = grow(this.z, (n) => new Float32Array(n));
    this.b0 = grow(this.b0, (n) => new Float32Array(n));
    this.b1 = grow(this.b1, (n) => new Float32Array(n));
    this.b2 = grow(this.b2, (n) => new Float32Array(n));
  }

  push(tri: number, x: number, y: number, z: number, b0: number, b1: number, b2: number) {
    if (this.count === this.tri.length) this.resize(this.tri.length * 2);
    const i = this.count++;
    this.tri[i] = tri;
    this.x[i] = x;
    this.y[i] = y;
    this.z[i] = z;
    this.b0[i] = b0;
    this.b1[i] = b1;
    this.b2[i] = b2;
  }
}

export function rasterStage(mesh: MeshData, vtx: VertexOutput, cull: CullOutput, res: Resolution): RasterOutput {
  const buffer = new FragmentBuffer(Math.max(1024, res.width * res.height * 2));
  const start = new Uint32Array(cull.visible.length + 1);
  const I = mesh.indices;
  const S = vtx.screen;
  const C = vtx.clip;

  for (let k = 0; k < cull.visible.length; k++) {
    start[k] = buffer.count;
    const t = cull.visible[k];
    const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
    const x0 = S[a * 3], y0 = S[a * 3 + 1], z0 = S[a * 3 + 2];
    const x1 = S[b * 3], y1 = S[b * 3 + 1], z1 = S[b * 3 + 2];
    const x2 = S[c * 3], y2 = S[c * 3 + 1], z2 = S[c * 3 + 2];
    const area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
    if (Math.abs(area) < 1e-12) continue;
    const iw0 = 1 / C[a * 4 + 3], iw1 = 1 / C[b * 4 + 3], iw2 = 1 / C[c * 4 + 3];

    // Pixels whose centre (px + 0.5) lies inside the triangle's bounding box.
    const minX = Math.max(0, Math.ceil(Math.min(x0, x1, x2) - 0.5));
    const maxX = Math.min(res.width - 1, Math.floor(Math.max(x0, x1, x2) - 0.5));
    const minY = Math.max(0, Math.ceil(Math.min(y0, y1, y2) - 0.5));
    const maxY = Math.min(res.height - 1, Math.floor(Math.max(y0, y1, y2) - 0.5));

    for (let py = minY; py <= maxY; py++) {
      const sy = py + 0.5;
      for (let px = minX; px <= maxX; px++) {
        const sx = px + 0.5;
        // Edge functions, normalised so they are the screen-space barycentrics.
        const l0 = ((x2 - x1) * (sy - y1) - (y2 - y1) * (sx - x1)) / area;
        const l1 = ((x0 - x2) * (sy - y2) - (y0 - y2) * (sx - x2)) / area;
        const l2 = 1 - l0 - l1;
        if (l0 < 0 || l1 < 0 || l2 < 0) continue;
        const q0 = l0 * iw0, q1 = l1 * iw1, q2 = l2 * iw2;
        const qs = q0 + q1 + q2;
        buffer.push(t, px, py, l0 * z0 + l1 * z1 + l2 * z2, q0 / qs, q1 / qs, q2 / qs);
      }
    }
  }
  start[cull.visible.length] = buffer.count;
  return { count: buffer.count, tri: buffer.tri, x: buffer.x, y: buffer.y, z: buffer.z, b0: buffer.b0, b1: buffer.b1, b2: buffer.b2, start };
}

// ---------------------------------------------------------------------------
// 4. Fragment stage: Lambert diffuse + Blinn-Phong highlight
// ---------------------------------------------------------------------------

/** Shared with the GPU shader in worldView.ts, so the full-resolution render matches. */
export const MATERIAL = {
  baseColor: [0.87, 0.56, 0.32] as const,
  ambient: 0.12,
  specular: 0.45,
  shininess: 40,
};

export interface FragmentOptions {
  smooth: boolean;
  /** Unit vector pointing towards the (directional) light, world space. */
  lightDirection: THREE.Vector3;
}

export interface FragmentOutput {
  color: Float32Array; // rgb 0..1 per fragment
  normal: Float32Array; // world normal per fragment
}

export interface ShadeResult {
  diffuse: number;
  specular: number;
  color: [number, number, number];
}

/** The fragment shader itself. N, L and V must be unit vectors. */
export function shade(n: THREE.Vector3, l: THREE.Vector3, v: THREE.Vector3): ShadeResult {
  const diffuse = Math.max(0, n.dot(l));
  const h = l.clone().add(v).normalize();
  const specular = diffuse > 0 ? MATERIAL.specular * Math.pow(Math.max(0, n.dot(h)), MATERIAL.shininess) : 0;
  const [r, g, b] = MATERIAL.baseColor;
  const light = MATERIAL.ambient + (1 - MATERIAL.ambient) * diffuse;
  const clamp = (x: number) => Math.min(1, x);
  return { diffuse, specular, color: [clamp(r * light + specular), clamp(g * light + specular), clamp(b * light + specular)] };
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

/** World-space face normal of triangle t. */
export function faceNormal(mesh: MeshData, vtx: VertexOutput, t: number, target = new THREE.Vector3()) {
  const W = vtx.world;
  const a = mesh.indices[t * 3], b = mesh.indices[t * 3 + 1], c = mesh.indices[t * 3 + 2];
  tmpA.set(W[b * 3] - W[a * 3], W[b * 3 + 1] - W[a * 3 + 1], W[b * 3 + 2] - W[a * 3 + 2]);
  tmpB.set(W[c * 3] - W[a * 3], W[c * 3 + 1] - W[a * 3 + 1], W[c * 3 + 2] - W[a * 3 + 2]);
  return target.crossVectors(tmpA, tmpB).normalize();
}

/** Interpolates a per-vertex vec3 attribute at fragment i. */
export function interpolate(mesh: MeshData, raster: RasterOutput, attribute: Float32Array, i: number, target = new THREE.Vector3()) {
  const t = raster.tri[i];
  const a = mesh.indices[t * 3], b = mesh.indices[t * 3 + 1], c = mesh.indices[t * 3 + 2];
  const w0 = raster.b0[i], w1 = raster.b1[i], w2 = raster.b2[i];
  return target.set(
    w0 * attribute[a * 3] + w1 * attribute[b * 3] + w2 * attribute[c * 3],
    w0 * attribute[a * 3 + 1] + w1 * attribute[b * 3 + 1] + w2 * attribute[c * 3 + 1],
    w0 * attribute[a * 3 + 2] + w1 * attribute[b * 3 + 2] + w2 * attribute[c * 3 + 2]
  );
}

export interface FragmentDetails extends ShadeResult {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  lightDirection: THREE.Vector3;
  viewDirection: THREE.Vector3;
}

/** Runs the fragment shader for one fragment and returns every input and output. */
export function shadeFragment(mesh: MeshData, vtx: VertexOutput, raster: RasterOutput, i: number, t: Transforms, options: FragmentOptions): FragmentDetails {
  const position = interpolate(mesh, raster, vtx.world, i);
  const normal = options.smooth ? interpolate(mesh, raster, vtx.worldNormal, i).normalize() : faceNormal(mesh, vtx, raster.tri[i]);
  const lightDirection = options.lightDirection.clone();
  const viewDirection = t.cameraPosition.clone().sub(position).normalize();
  return { position, normal, lightDirection, viewDirection, ...shade(normal, lightDirection, viewDirection) };
}

export function fragmentStage(mesh: MeshData, vtx: VertexOutput, raster: RasterOutput, t: Transforms, options: FragmentOptions): FragmentOutput {
  const color = new Float32Array(raster.count * 3);
  const normal = new Float32Array(raster.count * 3);
  for (let i = 0; i < raster.count; i++) {
    const f = shadeFragment(mesh, vtx, raster, i, t, options);
    color.set(f.color, i * 3);
    normal.set([f.normal.x, f.normal.y, f.normal.z], i * 3);
  }
  return { color, normal };
}

// ---------------------------------------------------------------------------
// 5. Depth stage: z-buffer and output
// ---------------------------------------------------------------------------

export interface DepthOutput {
  /** Fragment index that ended up in each pixel, or -1. */
  winner: Int32Array;
  /** Depth buffer, cleared to 1 (far plane). */
  depth: Float32Array;
  /** How many fragments landed on each pixel. */
  overdraw: Uint16Array;
  coveredPixels: number;
}

/** Writes fragments in order (triangle order). With the depth test on, a
 * fragment only replaces what's there if it's closer; with it off, the last
 * fragment written simply wins. `limit` processes only the first fragments,
 * for the step-by-step animations. */
export function depthStage(raster: RasterOutput, res: Resolution, options: { depthTest: boolean; limit?: number }): DepthOutput {
  const size = res.width * res.height;
  const winner = new Int32Array(size).fill(-1);
  const depth = new Float32Array(size).fill(1);
  const overdraw = new Uint16Array(size);
  const end = Math.min(raster.count, options.limit ?? raster.count);
  for (let i = 0; i < end; i++) {
    const p = raster.y[i] * res.width + raster.x[i];
    overdraw[p]++;
    if (options.depthTest && raster.z[i] >= depth[p]) continue;
    depth[p] = raster.z[i];
    winner[p] = i;
  }
  let coveredPixels = 0;
  for (let p = 0; p < size; p++) if (winner[p] >= 0) coveredPixels++;
  return { winner, depth, overdraw, coveredPixels };
}

// ---------------------------------------------------------------------------
// Helpers shared by both views
// ---------------------------------------------------------------------------

/** World-space point on the near (ndcZ = -1) or far (ndcZ = 1) plane under a screen position in pixels. */
export function unprojectScreen(t: Transforms, res: Resolution, sx: number, sy: number, ndcZ: number, target = new THREE.Vector3()) {
  const inverse = new THREE.Matrix4().multiplyMatrices(t.projection, t.view).invert();
  return target.set((sx / res.width) * 2 - 1, 1 - (sy / res.height) * 2, ndcZ).applyMatrix4(inverse);
}
