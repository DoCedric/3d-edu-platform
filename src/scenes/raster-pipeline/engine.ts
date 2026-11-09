/**
 * State for the "Rasterization pipeline" demo: Suzanne's rotation, the scene
 * camera, the current step and its toggles, selection, and the cached output
 * of every pipeline stage. Framework-free; the React page owns one instance
 * and both views only read from it.
 */

import * as THREE from "three";
import {
  cullStage,
  depthStage,
  fragmentStage,
  rasterStage,
  vertexStage,
  type CullOutput,
  type DepthOutput,
  type FragmentOutput,
  type MeshData,
  type RasterOutput,
  type Resolution,
  type Transforms,
  type VertexOutput,
} from "./pipeline";

export const STEP_COUNT = 7;

/** Length of each step's entry animation, in ms. */
const ENTRY_DURATION = [1000, 1800, 1300, 1600, 1200, 1500, 1000];
/** Time per space while animating between coordinate spaces (step 1). */
const SPACE_SEGMENT_MS = 450;
const SHIFT_MS = 350;

export type Space = "model" | "world" | "view" | "screen";

export const SPACES: Space[] = ["model", "world", "view", "screen"];

/** Step-specific controls. They all go back to these defaults when a step is entered. */
export interface Toggles {
  space: Space;
  backFaceCulling: boolean;
  shiftCamera: boolean;
  overdraw: boolean;
  /** Step 3: rasterize only the first N surviving triangles; null = all. */
  rasterLimit: number | null;
  smooth: boolean;
  showNormals: boolean;
  buffer: "color" | "depth";
  depthTest: boolean;
  /** Step 6: position of the wipe divider, 0..1 from the left. */
  divider: number;
}

export const DEFAULT_TOGGLES: Toggles = {
  space: "screen",
  backFaceCulling: true,
  shiftCamera: false,
  overdraw: false,
  rasterLimit: null,
  smooth: true,
  showNormals: false,
  buffer: "color",
  depthTest: true,
  divider: 0.5,
};

export type Selection = { kind: "vertex"; index: number } | { kind: "triangle"; index: number } | { kind: "pixel"; x: number; y: number } | null;

export interface WorldPick {
  /** Triangle under the pointer, or -1. */
  triangle: number;
  point: THREE.Vector3 | null;
  /** Vertex dot near the pointer (steps 0-1), or -1. */
  vertex: number;
}

export const DEFAULT_RESOLUTION = 48;
export const MIN_RESOLUTION = 16;
export const MAX_RESOLUTION = 320;

/** The scene camera: a fixed pose looking at Suzanne, 4:3 like the pixel grid. */
const CAMERA_POSITION = new THREE.Vector3(0, 0.25, 3.5);
const CAMERA_SHIFT = new THREE.Vector3(1.3, 0, 0);
export const CAMERA_FOV = 36;
export const CAMERA_NEAR = 1.2;
export const CAMERA_FAR = 5;

const DEFAULT_LIGHT = { azimuth: 40, elevation: 35 };

let nextEngineId = 1;

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export class RasterPipelineEngine {
  /** Unique per instance; the page keys its WebGL canvases on it so each model gets fresh contexts. */
  readonly id = nextEngineId++;
  readonly mesh: MeshData;
  readonly camera = new THREE.PerspectiveCamera(CAMERA_FOV, 4 / 3, CAMERA_NEAR, CAMERA_FAR);
  rotation = new THREE.Quaternion();
  resolution: Resolution = { width: DEFAULT_RESOLUTION, height: (DEFAULT_RESOLUTION * 3) / 4 };
  light = { ...DEFAULT_LIGHT };
  step = 0;
  toggles: Toggles = { ...DEFAULT_TOGGLES };
  selection: Selection = null;
  hover: Selection = null;
  reducedMotion = false;

  /** Bumped whenever something the React UI shows may have changed. */
  version = 0;
  /** Bumped whenever the pipeline output is recomputed. */
  outputVersion = 0;

  transforms!: Transforms;
  vertices!: VertexOutput;
  cull!: CullOutput;
  raster!: RasterOutput;
  fragments!: FragmentOutput;
  depth!: DepthOutput;
  /** Position of each triangle in cull.visible, or -1 if it was culled. */
  visibleIndex!: Int32Array;

  private now = 0;
  private dirty = true;
  private entryStart = -Infinity;
  private shift = 0;
  private shiftFrom = 0;
  private shiftStart = -Infinity;
  private spacePath: Space[] = ["screen"];
  private spaceStart = -Infinity;

  constructor(mesh: MeshData) {
    this.mesh = mesh;
    this.placeCamera();
    this.recompute();
  }

  // -------------------------------------------------------------------------
  // Time and animation
  // -------------------------------------------------------------------------

  update(now: number) {
    this.now = now;
    const target = this.toggles.shiftCamera ? 1 : 0;
    if (this.shift !== target) {
      const t = this.reducedMotion ? 1 : Math.min(1, (now - this.shiftStart) / SHIFT_MS);
      this.shift = this.shiftFrom + (target - this.shiftFrom) * easeInOut(t);
      if (t >= 1) this.shift = target;
      this.placeCamera();
      this.dirty = true;
    }
    if (this.dirty) this.recompute();
  }

  /** 0..1 progress of the current step's entry animation. */
  get entryProgress() {
    if (this.reducedMotion) return 1;
    return Math.min(1, Math.max(0, (this.now - this.entryStart) / ENTRY_DURATION[this.step]));
  }

  get animating() {
    return this.entryProgress < 1 || this.spaceProgress().t < 1;
  }

  skipAnimation() {
    this.entryStart = -Infinity;
    this.spaceStart = -Infinity;
    this.version++;
  }

  /** Where the step-1 space animation is: blending from `from` to `to` by `t` (eased). */
  spaceProgress(): { from: Space; to: Space; t: number } {
    const path = this.spacePath;
    if (path.length < 2 || this.reducedMotion) return { from: path[path.length - 1], to: path[path.length - 1], t: 1 };
    const elapsed = (this.now - this.spaceStart) / SPACE_SEGMENT_MS;
    if (elapsed >= path.length - 1) return { from: path[path.length - 2], to: path[path.length - 1], t: 1 };
    const segment = Math.max(0, Math.floor(elapsed));
    return { from: path[segment], to: path[segment + 1], t: easeInOut(Math.max(0, elapsed - segment)) };
  }

  // -------------------------------------------------------------------------
  // Changing state
  // -------------------------------------------------------------------------

  /** Carries the view state over from the engine of a previously shown model. */
  adopt(previous: RasterPipelineEngine) {
    this.rotation.copy(previous.rotation);
    this.resolution = { ...previous.resolution };
    this.light = { ...previous.light };
    this.step = previous.step;
    this.reducedMotion = previous.reducedMotion;
    this.dirty = true;
  }

  setReducedMotion(reduced: boolean) {
    this.reducedMotion = reduced;
  }

  setStep(step: number) {
    this.step = Math.max(0, Math.min(STEP_COUNT - 1, step));
    this.toggles = { ...DEFAULT_TOGGLES };
    this.selection = null;
    this.hover = null;
    this.entryStart = this.now;
    this.shift = 0;
    this.placeCamera();
    // Step 1 opens by running through every space once, ending on Screen.
    this.spacePath = this.step === 1 ? SPACES : ["screen"];
    this.spaceStart = this.now;
    this.dirty = true;
    this.version++;
  }

  setToggles(patch: Partial<Toggles>) {
    const previous = this.toggles;
    const next = { ...previous, ...patch };
    if (next.space !== previous.space) {
      this.spacePath = [this.spaceProgress().to, next.space];
      this.spaceStart = this.now;
    }
    if (next.shiftCamera !== previous.shiftCamera) {
      this.shiftFrom = this.shift;
      this.shiftStart = this.now;
    }
    this.toggles = next;
    this.dirty = true;
    this.version++;
  }

  setResolution(width: number) {
    const w = Math.round(Math.max(MIN_RESOLUTION, Math.min(MAX_RESOLUTION, width)) / 4) * 4;
    this.resolution = { width: w, height: (w * 3) / 4 };
    if (this.selection?.kind === "pixel") this.selection = null;
    this.hover = null;
    this.dirty = true;
    this.version++;
  }

  setLight(light: Partial<{ azimuth: number; elevation: number }>) {
    this.light = { ...this.light, ...light };
    this.dirty = true;
    this.version++;
  }

  /** Rotates Suzanne about a world-space axis through her centre. */
  rotate(axis: THREE.Vector3, angle: number) {
    if (!angle) return;
    this.rotation.premultiply(new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), angle)).normalize();
    this.dirty = true;
  }

  resetRotation() {
    this.rotation.identity();
    this.dirty = true;
    this.version++;
  }

  setSelection(selection: Selection) {
    this.selection = selection;
    this.version++;
  }

  setHover(hover: Selection) {
    if (JSON.stringify(hover) === JSON.stringify(this.hover)) return;
    this.hover = hover;
    this.version++;
  }

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------

  /** Step 5 with the depth test off also draws back faces, so the back of
   * the head visibly paints over the front when nothing sorts by depth. */
  get backFaceCulling() {
    return this.toggles.backFaceCulling && !(this.step === 5 && !this.toggles.depthTest);
  }

  get lightDirection() {
    const az = THREE.MathUtils.degToRad(this.light.azimuth);
    const el = THREE.MathUtils.degToRad(this.light.elevation);
    return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  }

  /** Linked highlight: what the pointer is over, else what was tapped. */
  get display(): Selection {
    return this.hover ?? this.selection;
  }

  /** Fragment that ended up in pixel (x, y), or -1. */
  winnerAt(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.resolution.width || y >= this.resolution.height) return -1;
    return this.depth.winner[y * this.resolution.width + x];
  }

  /** Every fragment that landed on pixel (x, y), in the order they were written. */
  fragmentsAt(x: number, y: number) {
    const list: number[] = [];
    for (let i = 0; i < this.raster.count; i++) if (this.raster.x[i] === x && this.raster.y[i] === y) list.push(i);
    return list;
  }

  /** Fragment index range produced by triangle t (empty if it was culled). */
  fragmentRange(t: number): [number, number] {
    const k = this.visibleIndex[t];
    return k < 0 ? [0, 0] : [this.raster.start[k], this.raster.start[k + 1]];
  }

  /** Closest vertex to a screen position (in grid pixels), within maxDistance, or -1. */
  vertexNearScreen(sx: number, sy: number, maxDistance: number) {
    let best = -1;
    let bestDistance = maxDistance * maxDistance;
    const S = this.vertices.screen;
    for (let i = 0; i < this.mesh.vertexCount; i++) {
      const d = (S[i * 3] - sx) ** 2 + (S[i * 3 + 1] - sy) ** 2;
      // Prefer the vertex nearest the camera when several overlap.
      if (d < bestDistance - 1e-9 || (best >= 0 && Math.abs(d - bestDistance) < 1e-9 && S[i * 3 + 2] < S[best * 3 + 2])) {
        best = i;
        bestDistance = d;
      }
    }
    return best;
  }

  /** Pixel a world-space point projects to, or null if outside the image. */
  pixelOf(point: THREE.Vector3) {
    const ndc = point.clone().applyMatrix4(this.transforms.view).applyMatrix4(this.transforms.projection);
    const x = Math.floor(((ndc.x + 1) / 2) * this.resolution.width);
    const y = Math.floor(((1 - ndc.y) / 2) * this.resolution.height);
    if (x < 0 || y < 0 || x >= this.resolution.width || y >= this.resolution.height) return null;
    return { x, y };
  }

  get counts() {
    return {
      vertices: this.mesh.vertexCount,
      triangles: this.mesh.triangleCount,
      surviving: this.cull.visible.length,
      fragments: this.raster.count,
      pixels: this.resolution.width * this.resolution.height,
    };
  }

  // -------------------------------------------------------------------------
  // Picking -> selection, per step
  // -------------------------------------------------------------------------

  /** A click/tap in the screen view at grid position (sx, sy). */
  clickScreen(sx: number, sy: number, vertexRadius: number) {
    if (this.step === 1) {
      const vertex = this.vertexNearScreen(sx, sy, vertexRadius);
      if (vertex >= 0) return this.setSelection({ kind: "vertex", index: vertex });
    }
    const x = Math.floor(sx), y = Math.floor(sy);
    const same = this.selection?.kind === "pixel" && this.selection.x === x && this.selection.y === y;
    this.setSelection(this.winnerAt(x, y) >= 0 && !same ? { kind: "pixel", x, y } : null);
  }

  hoverScreen(sx: number, sy: number) {
    const x = Math.floor(sx), y = Math.floor(sy);
    this.setHover(this.winnerAt(x, y) >= 0 ? { kind: "pixel", x, y } : null);
  }

  clickWorld(pick: WorldPick) {
    if (this.step === 1 && pick.vertex >= 0) return this.setSelection({ kind: "vertex", index: pick.vertex });
    if (pick.triangle < 0) return this.setSelection(null);
    // In the shading and depth steps a click on the model picks the fragment there.
    if ((this.step === 4 || this.step === 5) && pick.point) {
      const pixel = this.pixelOf(pick.point);
      if (pixel && this.winnerAt(pixel.x, pixel.y) >= 0) return this.setSelection({ kind: "pixel", ...pixel });
    }
    this.setSelection({ kind: "triangle", index: pick.triangle });
  }

  hoverWorld(pick: WorldPick | null) {
    this.setHover(pick && pick.triangle >= 0 ? { kind: "triangle", index: pick.triangle } : null);
  }

  // -------------------------------------------------------------------------
  // Pipeline
  // -------------------------------------------------------------------------

  private placeCamera() {
    this.camera.position.copy(CAMERA_POSITION).addScaledVector(CAMERA_SHIFT, this.shift);
    this.camera.lookAt(CAMERA_SHIFT.clone().multiplyScalar(this.shift));
    this.camera.updateMatrixWorld(true);
    this.camera.updateProjectionMatrix();
  }

  private recompute() {
    this.dirty = false;
    this.transforms = {
      model: new THREE.Matrix4().makeRotationFromQuaternion(this.rotation),
      view: this.camera.matrixWorldInverse.clone(),
      projection: this.camera.projectionMatrix.clone(),
      cameraPosition: this.camera.position.clone(),
    };
    const res = this.resolution;
    this.vertices = vertexStage(this.mesh, this.transforms, res);
    this.cull = cullStage(this.mesh, this.vertices, { backFaceCulling: this.backFaceCulling });
    this.visibleIndex = new Int32Array(this.mesh.triangleCount).fill(-1);
    this.cull.visible.forEach((t, k) => (this.visibleIndex[t] = k));
    this.raster = rasterStage(this.mesh, this.vertices, this.cull, res);
    this.fragments = fragmentStage(this.mesh, this.vertices, this.raster, this.transforms, { smooth: this.toggles.smooth, lightDirection: this.lightDirection });
    this.depth = depthStage(this.raster, res, { depthTest: this.toggles.depthTest });
    this.outputVersion++;
    this.version++;
  }
}
