/**
 * World view (3D) for the "Rasterization pipeline" demo: Suzanne, the light,
 * and the scene camera with its frustum, seen by a separate "observer"
 * camera. Plain three.js (no React Three Fiber) because the pointer handling
 * is custom: what you grab decides what moves, and a short click selects.
 *
 * Also home to the GPU material, shared with the full-resolution render of
 * the final step, which computes exactly what pipeline.ts's shade() does.
 */

import * as THREE from "three";
import { CAMERA_FAR, CAMERA_NEAR, type RasterPipelineEngine, type Space, type WorldPick } from "./engine";
import { faceNormal, MATERIAL, shadeFragment, TRI_BACK, TRI_OUTSIDE, unprojectScreen, type MeshData } from "./pipeline";

export interface ThemeColors {
  bg: string;
  elevated: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
}

/** The scene camera's own accent colour, used in both views' labels too. */
export const CAMERA_COLOR = "#f59e0b";
export const BACK_COLOR = "#e5484d";
export const OUTSIDE_COLOR = "#8b8b93";
const LIGHT_COLOR = "#facc15";
const AXIS_COLORS = ["#ef4444", "#22c55e", "#3b82f6"];

/** A pointer movement only becomes a drag after this many CSS pixels. */
export const DRAG_THRESHOLD = 4;

const SPACE_LABELS: Record<Space, string> = {
  model: "Model space",
  world: "World space",
  view: "View space",
  screen: "Screen space",
};

/** Drag rotates this many radians per CSS pixel. */
const ROTATE_SPEED = 0.01;

// ---------------------------------------------------------------------------
// Shared GPU material
// ---------------------------------------------------------------------------

const vec3 = (rgb: readonly number[]) => new THREE.Vector3(rgb[0], rgb[1], rgb[2]);
const hexToVec3 = (hex: string) => {
  const c = new THREE.Color();
  c.setHex(parseInt(hex.slice(1), 16), THREE.LinearSRGBColorSpace);
  return new THREE.Vector3(c.r, c.g, c.b);
};

/** Lambert + Blinn-Phong, matching pipeline.ts's shade(). Outputs raw values
 * (no colour-space conversion), just like the software rasterizer. The
 * `state` attribute marks culled triangles: 1 = back face (red, striped),
 * 2 = outside the frustum (grey). */
export function createShadingMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLight: { value: new THREE.Vector3(0, 1, 0) },
      uCameraPos: { value: new THREE.Vector3() },
      uBase: { value: vec3(MATERIAL.baseColor) },
      uAmbient: { value: MATERIAL.ambient },
      uSpecular: { value: MATERIAL.specular },
      uShininess: { value: MATERIAL.shininess },
      uBackColor: { value: hexToVec3(BACK_COLOR) },
      uOutsideColor: { value: hexToVec3(OUTSIDE_COLOR) },
      uFlat: { value: 0 },
      uNormals: { value: 0 },
      uShowState: { value: 0 },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float state;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vState;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPos = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vState = state;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uLight, uCameraPos, uBase, uBackColor, uOutsideColor;
      uniform float uAmbient, uSpecular, uShininess, uFlat, uNormals, uShowState, uOpacity;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vState;
      void main() {
        vec3 n = normalize(vNormal);
        if (uFlat > 0.5) {
          vec3 face = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
          n = dot(face, n) < 0.0 ? -face : face;
        }
        vec3 base = uBase;
        float state = uShowState > 0.5 ? floor(vState + 0.5) : 0.0;
        if (state == 1.0) {
          if (mod(gl_FragCoord.x + gl_FragCoord.y, 10.0) < 5.0) discard;
          base = uBackColor;
        } else if (state == 2.0) {
          base = uOutsideColor;
        }
        if (uNormals > 0.5 && state == 0.0) {
          gl_FragColor = vec4(n * 0.5 + 0.5, uOpacity);
          return;
        }
        vec3 l = normalize(uLight);
        vec3 v = normalize(uCameraPos - vWorldPos);
        float diffuse = max(dot(n, l), 0.0);
        vec3 h = normalize(l + v);
        float specular = diffuse > 0.0 ? uSpecular * pow(max(dot(n, h), 0.0), uShininess) : 0.0;
        gl_FragColor = vec4(min(base * (uAmbient + (1.0 - uAmbient) * diffuse) + specular, 1.0), uOpacity);
      }
    `,
  });
}

/** Non-indexed copy of the mesh (one entry per triangle corner) so each
 * triangle can carry its own culling state. Face index = triangle index. */
export function createWorldGeometry(mesh: MeshData) {
  const corners = mesh.triangleCount * 3;
  const position = new Float32Array(corners * 3);
  const normal = new Float32Array(corners * 3);
  for (let c = 0; c < corners; c++) {
    const v = mesh.indices[c];
    position.set(mesh.positions.subarray(v * 3, v * 3 + 3), c * 3);
    normal.set(mesh.normals.subarray(v * 3, v * 3 + 3), c * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute("state", new THREE.BufferAttribute(new Float32Array(corners), 1));
  geometry.computeBoundingSphere();
  return geometry;
}

// ---------------------------------------------------------------------------
// Small three.js helpers
// ---------------------------------------------------------------------------

function makeLabel(text: string, color = "#ffffff") {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = "600 40px Arial, Helvetica, sans-serif";
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 28;
  canvas.width = w;
  canvas.height = 60;
  ctx.font = font;
  ctx.fillStyle = "rgba(15, 15, 17, 0.75)";
  ctx.beginPath();
  ctx.roundRect(0, 0, w, 60, 14);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 14, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, sizeAttenuation: false }));
  const height = 0.03;
  sprite.scale.set((height * w) / 60, height, 1);
  sprite.center.set(0, 0);
  sprite.renderOrder = 10;
  return sprite;
}

function setLabelText(sprite: THREE.Sprite, text: string, color?: string) {
  if (sprite.userData.text === text) return;
  const fresh = makeLabel(text, color);
  sprite.material.map?.dispose();
  sprite.material.dispose();
  sprite.material = fresh.material;
  sprite.scale.copy(fresh.scale);
  sprite.userData.text = text;
}

function lineMaterial(color: string, opacity = 1, depthTest = true) {
  return new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, depthTest });
}

function segments(points: THREE.Vector3[], material: THREE.LineBasicMaterial) {
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), material);
}

/** A dynamic line/points geometry with room for `count` points. */
function dynamicGeometry(count: number) {
  const geometry = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", attribute);
  return geometry;
}

function setPoints(object: THREE.Line | THREE.Points | THREE.Mesh, points: ArrayLike<number>, count: number) {
  const attribute = object.geometry.getAttribute("position") as THREE.BufferAttribute;
  (attribute.array as Float32Array).set(points);
  attribute.needsUpdate = true;
  object.geometry.setDrawRange(0, count);
  object.geometry.computeBoundingSphere();
}

/** Axis gizmo: X red, Y green, Z blue, plus a name tag. */
function makeAxisGizmo() {
  const group = new THREE.Group();
  const length = 0.7;
  const axes = [new THREE.Vector3(length, 0, 0), new THREE.Vector3(0, length, 0), new THREE.Vector3(0, 0, length)];
  axes.forEach((axis, i) => {
    const line = segments([new THREE.Vector3(), axis], lineMaterial(AXIS_COLORS[i], 1, false));
    line.renderOrder = 5;
    group.add(line);
    const tip = makeLabel("xyz"[i], AXIS_COLORS[i]);
    tip.scale.multiplyScalar(0.7);
    tip.position.copy(axis).multiplyScalar(1.08);
    group.add(tip);
  });
  const label = makeLabel("World space");
  label.position.set(0.05, -0.18, 0);
  group.add(label);
  return { group, label };
}

/** A small camera body with a lens, plus its frustum (near plane outlined). */
function makeSceneCamera(camera: THREE.PerspectiveCamera) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshBasicMaterial({ color: CAMERA_COLOR });
  const darkMaterial = new THREE.MeshBasicMaterial({ color: "#3f3f46" });
  const edgeMaterial = lineMaterial("#1c1917");

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.32), bodyMaterial);
  body.position.z = 0.28;
  body.add(new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), edgeMaterial));
  group.add(body);
  for (const x of [-0.1, 0.1]) {
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 24), bodyMaterial);
    reel.rotation.z = Math.PI / 2;
    reel.position.set(x * 1.1, 0.25, 0.28);
    reel.add(new THREE.LineSegments(new THREE.EdgesGeometry(reel.geometry, 30), edgeMaterial));
    group.add(reel);
  }
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.14, 24), darkMaterial);
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.06;
  group.add(lens);

  // Frustum, in camera-local coordinates (the camera looks down -z).
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const corners = (d: number) => {
    const h = d * tan, w = h * camera.aspect;
    return [new THREE.Vector3(-w, h, -d), new THREE.Vector3(w, h, -d), new THREE.Vector3(w, -h, -d), new THREE.Vector3(-w, -h, -d)];
  };
  const near = corners(CAMERA_NEAR), far = corners(CAMERA_FAR);
  const rect = (c: THREE.Vector3[]) => [c[0], c[1], c[1], c[2], c[2], c[3], c[3], c[0]];
  const apex = new THREE.Vector3();
  group.add(segments([...far.flatMap((c) => [apex, c]), ...rect(far)], lineMaterial(CAMERA_COLOR, 0.45)));
  group.add(segments(rect(near), lineMaterial(CAMERA_COLOR)));
  const nearW = near[1].x * 2, nearH = near[0].y * 2;
  const nearFill = new THREE.Mesh(
    new THREE.PlaneGeometry(nearW, nearH),
    new THREE.MeshBasicMaterial({ color: CAMERA_COLOR, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })
  );
  nearFill.position.z = -CAMERA_NEAR;
  group.add(nearFill);

  const label = makeLabel("Scene camera", CAMERA_COLOR);
  label.position.set(-0.2, 0.42, 0.3);
  group.add(label);
  return group;
}

function makeArrow(color: string, text: string) {
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.6, color, 0.14, 0.08);
  arrow.traverse((child) => {
    const material = (child as THREE.Mesh).material as THREE.Material | undefined;
    if (material) material.depthTest = false;
    child.renderOrder = 8;
  });
  const label = makeLabel(text, color);
  label.scale.multiplyScalar(0.8);
  label.position.set(0, 0.66, 0);
  arrow.add(label);
  return arrow;
}

// ---------------------------------------------------------------------------
// World view
// ---------------------------------------------------------------------------

interface WorldViewCallbacks {
  onRotate: (axis: THREE.Vector3, angle: number) => void;
  onClick: (pick: WorldPick) => void;
  onHover: (pick: WorldPick | null) => void;
  onPointerDown: () => void;
}

interface PointerState {
  x: number;
  y: number;
  startX: number;
  startY: number;
  button: number;
  shift: boolean;
  onModel: boolean;
  dragging: boolean;
}

/** Cursor shown over Suzanne: a circular arrow ("rotate"). */
const ROTATE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="white" stroke-width="4"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></g><g stroke="black" stroke-width="2"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></g></svg>'
)}") 12 12, move`;

export class WorldView {
  readonly geometry: THREE.BufferGeometry;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private observer = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  private orbit = { target: new THREE.Vector3(), spherical: new THREE.Spherical() };
  private defaultOrbit = { target: new THREE.Vector3(), spherical: new THREE.Spherical() };
  private zoomRange = { min: 3, max: 30 };
  private width = 1;
  private height = 1;

  private model: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private stateVersion = -1;
  private stateStep = -1;
  private sceneCamera: THREE.Group;
  private lightGizmo: THREE.Group;
  private vertexDots: THREE.Points;
  private selectedVertex: THREE.Points;
  private projectionLines: THREE.LineSegments;
  private gizmo: ReturnType<typeof makeAxisGizmo>;
  private highlight: THREE.Mesh;
  private highlightOutline: THREE.LineLoop;
  private ray: THREE.Line;
  private rayHit: THREE.Mesh;
  private pixelCell: THREE.LineLoop;
  private arrows: { normal: THREE.ArrowHelper; light: THREE.ArrowHelper; view: THREE.ArrowHelper };

  private displayPositions: Float32Array;
  private raycaster = new THREE.Raycaster();
  private pointers = new Map<number, PointerState>();
  private pinchDistance = 0;
  private callbacks: WorldViewCallbacks;
  private engine: RasterPipelineEngine;
  private canvas: HTMLCanvasElement;
  private cleanup: () => void;

  constructor(canvas: HTMLCanvasElement, engine: RasterPipelineEngine, callbacks: WorldViewCallbacks) {
    this.canvas = canvas;
    this.engine = engine;
    this.callbacks = callbacks;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

    const mesh = engine.mesh;
    this.geometry = createWorldGeometry(mesh);
    this.material = createShadingMaterial();
    this.material.side = THREE.DoubleSide;
    // Push the surface back a little so vertex dots and outlines sit on top of it.
    this.material.polygonOffset = true;
    this.material.polygonOffsetFactor = 1;
    this.material.polygonOffsetUnits = 1;
    this.model = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.model);

    this.sceneCamera = makeSceneCamera(engine.camera);
    this.scene.add(this.sceneCamera);

    this.lightGizmo = new THREE.Group();
    const sun = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 12), new THREE.MeshBasicMaterial({ color: LIGHT_COLOR }));
    this.lightGizmo.add(sun);
    const sunArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0.18), 0.7, LIGHT_COLOR, 0.16, 0.1);
    this.lightGizmo.add(sunArrow);
    const sunLabel = makeLabel("Light", LIGHT_COLOR);
    sunLabel.position.set(0.15, 0.12, 0);
    this.lightGizmo.add(sunLabel);
    this.scene.add(this.lightGizmo);

    this.displayPositions = new Float32Array(mesh.vertexCount * 3);
    this.vertexDots = new THREE.Points(dynamicGeometry(mesh.vertexCount), new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, transparent: true }));
    this.scene.add(this.vertexDots);
    this.selectedVertex = new THREE.Points(dynamicGeometry(1), new THREE.PointsMaterial({ size: 12, sizeAttenuation: false, depthTest: false }));
    this.selectedVertex.renderOrder = 9;
    this.scene.add(this.selectedVertex);
    this.projectionLines = new THREE.LineSegments(dynamicGeometry(mesh.vertexCount * 2), lineMaterial(CAMERA_COLOR, 0.35));
    this.scene.add(this.projectionLines);

    this.gizmo = makeAxisGizmo();
    this.scene.add(this.gizmo.group);

    this.highlight = new THREE.Mesh(dynamicGeometry(3), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthTest: false, side: THREE.DoubleSide }));
    this.highlight.renderOrder = 6;
    this.highlightOutline = new THREE.LineLoop(dynamicGeometry(3), lineMaterial("#ffffff", 1, false));
    this.highlightOutline.renderOrder = 7;
    this.ray = new THREE.Line(dynamicGeometry(2), lineMaterial("#ffffff", 1, false));
    this.ray.renderOrder = 7;
    this.rayHit = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ depthTest: false }));
    this.rayHit.renderOrder = 8;
    this.pixelCell = new THREE.LineLoop(dynamicGeometry(4), lineMaterial("#ffffff", 1, false));
    this.pixelCell.renderOrder = 7;
    this.scene.add(this.highlight, this.highlightOutline, this.ray, this.rayHit, this.pixelCell);

    this.arrows = { normal: makeArrow("#60a5fa", "N"), light: makeArrow(LIGHT_COLOR, "L"), view: makeArrow(CAMERA_COLOR, "V") };
    this.scene.add(this.arrows.normal, this.arrows.light, this.arrows.view);

    this.cleanup = this.attachPointerHandlers();
  }

  dispose() {
    this.cleanup();
    this.renderer.dispose();
  }

  resize(width: number, height: number) {
    if (width < 1 || height < 1) return;
    const first = this.width === 1 && this.height === 1;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.observer.aspect = width / height;
    this.observer.updateProjectionMatrix();
    // Keep the "show everything" framing correct for the new aspect ratio.
    const previousDefault = this.defaultOrbit.spherical.radius;
    this.computeDefaultFraming();
    if (first) this.resetView();
    else if (previousDefault) {
      const ratio = this.defaultOrbit.spherical.radius / previousDefault;
      this.orbit.spherical.radius *= ratio;
      this.zoomRange = { min: this.defaultOrbit.spherical.radius * 0.35, max: this.defaultOrbit.spherical.radius * 1.6 };
      this.clampOrbit();
    }
  }

  resetView() {
    this.orbit.target.copy(this.defaultOrbit.target);
    this.orbit.spherical.copy(this.defaultOrbit.spherical);
  }

  /** Default observer framing: Suzanne plus the whole scene camera and frustum, seen from the front-left. */
  private computeDefaultFraming() {
    const camera = this.engine.camera;
    const points: THREE.Vector3[] = [new THREE.Vector3(-1.2, -1, -1), new THREE.Vector3(1.2, 1, 1), camera.position.clone().add(new THREE.Vector3(0, 0.45, 0.4))];
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    for (const d of [CAMERA_NEAR, CAMERA_FAR]) {
      const h = d * tan, w = h * camera.aspect;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) points.push(new THREE.Vector3(sx * w, sy * h, -d).applyMatrix4(camera.matrixWorld));
    }
    const sphere = new THREE.Sphere().setFromPoints(points);
    const vfov = THREE.MathUtils.degToRad(this.observer.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.observer.aspect);
    const distance = sphere.radius / Math.sin(Math.min(vfov, hfov) / 2);
    this.defaultOrbit.target.copy(sphere.center);
    this.defaultOrbit.spherical.setFromVector3(new THREE.Vector3(-0.8, 0.45, 0.65).normalize().multiplyScalar(distance));
    this.zoomRange = { min: distance * 0.35, max: distance * 1.6 };
  }

  private clampOrbit() {
    const s = this.orbit.spherical;
    s.radius = THREE.MathUtils.clamp(s.radius, this.zoomRange.min, this.zoomRange.max);
    s.phi = THREE.MathUtils.clamp(s.phi, 0.08, Math.PI - 0.08);
    // Keep panning near the scene so the scene camera can't be lost.
    const offset = this.orbit.target.clone().sub(this.defaultOrbit.target);
    const maxPan = this.defaultOrbit.spherical.radius * 0.4;
    if (offset.length() > maxPan) this.orbit.target.copy(this.defaultOrbit.target).add(offset.setLength(maxPan));
  }

  private updateObserver() {
    this.clampOrbit();
    this.observer.position.setFromSpherical(this.orbit.spherical).add(this.orbit.target);
    this.observer.lookAt(this.orbit.target);
    this.observer.updateMatrixWorld();
  }

  // -------------------------------------------------------------------------
  // Pointer input
  // -------------------------------------------------------------------------

  private ndc(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  }

  /** What's under the pointer: a triangle of Suzanne and/or a vertex dot. */
  pick(clientX: number, clientY: number): WorldPick {
    this.updateObserver();
    const ndc = this.ndc(clientX, clientY);
    this.raycaster.setFromCamera(ndc, this.observer);
    this.model.quaternion.copy(this.engine.rotation);
    this.model.updateMatrixWorld();
    const hit = this.raycaster.intersectObject(this.model, false)[0];
    let vertex = -1;
    if (this.engine.step <= 1) {
      // Nearest visible vertex dot within ~12 px.
      const rect = this.canvas.getBoundingClientRect();
      const aspect = rect.width / rect.height;
      const limit = (12 / rect.height) * 2; // 12 px in NDC units
      let best = limit * limit;
      const p = new THREE.Vector3();
      const D = this.displayPositions;
      for (let i = 0; i < this.engine.mesh.vertexCount; i++) {
        p.set(D[i * 3], D[i * 3 + 1], D[i * 3 + 2]).project(this.observer);
        const d = ((p.x - ndc.x) * aspect) ** 2 + (p.y - ndc.y) ** 2;
        if (d < best && p.z < 1) {
          best = d;
          vertex = i;
        }
      }
    }
    return { triangle: hit?.faceIndex ?? -1, point: hit?.point ?? null, vertex };
  }

  private attachPointerHandlers() {
    const canvas = this.canvas;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 2) return;
      this.callbacks.onPointerDown();
      canvas.setPointerCapture(event.pointerId);
      const onModel = event.button === 0 && this.pick(event.clientX, event.clientY).triangle >= 0;
      this.pointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        button: event.button,
        shift: event.shiftKey,
        onModel,
        dragging: false,
      });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
        a.dragging = b.dragging = true; // a pinch is never a click
      }
      if (event.button === 1) event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent) => {
      const state = this.pointers.get(event.pointerId);
      if (!state) {
        // Plain hover (mouse/pen): linked highlight and cursor.
        if (event.pointerType === "touch") return;
        const pick = this.pick(event.clientX, event.clientY);
        canvas.style.cursor = pick.triangle >= 0 ? ROTATE_CURSOR : "grab";
        this.callbacks.onHover(pick);
        return;
      }
      const dx = event.clientX - state.x, dy = event.clientY - state.y;
      state.x = event.clientX;
      state.y = event.clientY;

      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDistance > 0) this.zoom(this.pinchDistance / distance);
        this.pinchDistance = distance;
        return;
      }
      if (!state.dragging && Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < DRAG_THRESHOLD) return;
      if (!state.dragging) {
        state.dragging = true;
        this.callbacks.onHover(null);
      }

      if (state.button === 1 && (state.shift || event.shiftKey)) {
        this.pan(dx, dy);
        canvas.style.cursor = "move";
      } else if (state.button === 0 && state.onModel) {
        // Trackball: drag right turns her about the observer's up axis, drag down about its right axis.
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.observer.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.observer.quaternion);
        const axis = up.multiplyScalar(dx).add(right.multiplyScalar(dy));
        this.callbacks.onRotate(axis, Math.hypot(dx, dy) * ROTATE_SPEED);
        canvas.style.cursor = ROTATE_CURSOR;
      } else {
        this.orbit.spherical.theta -= dx * 0.008;
        this.orbit.spherical.phi -= dy * 0.008;
        canvas.style.cursor = "grabbing";
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      const state = this.pointers.get(event.pointerId);
      if (!state) return;
      this.pointers.delete(event.pointerId);
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (this.pointers.size < 2) this.pinchDistance = 0;
      if (!state.dragging && event.type === "pointerup" && state.button === 0) this.callbacks.onClick(this.pick(event.clientX, event.clientY));
      if (event.pointerType !== "touch") canvas.style.cursor = this.pick(event.clientX, event.clientY).triangle >= 0 ? ROTATE_CURSOR : "grab";
    };

    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType !== "touch" && !this.pointers.size) this.callbacks.onHover(null);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      this.zoom(Math.exp(event.deltaY * 0.0012));
    };

    const onContextMenu = (event: Event) => event.preventDefault();
    // Middle-click would otherwise start the browser's autoscroll.
    const onAuxDown = (event: MouseEvent) => event.button === 1 && event.preventDefault();

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);
    canvas.addEventListener("mousedown", onAuxDown);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("mousedown", onAuxDown);
    };
  }

  private zoom(factor: number) {
    this.orbit.spherical.radius *= factor;
    this.clampOrbit();
  }

  private pan(dx: number, dy: number) {
    const scale = (2 * this.orbit.spherical.radius * Math.tan(THREE.MathUtils.degToRad(this.observer.fov / 2))) / this.height;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.observer.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.observer.quaternion);
    this.orbit.target.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
    this.clampOrbit();
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  /** World-space position of every vertex when shown in a given coordinate space. */
  private spacePositions(space: Space, target: Float32Array) {
    const engine = this.engine;
    const n = engine.mesh.vertexCount;
    const v = engine.vertices;
    if (space === "model") target.set(engine.mesh.positions);
    else if (space === "world" || space === "view") target.set(v.world);
    else {
      // Where the line from the camera to each vertex crosses the near plane.
      const c = engine.camera.position;
      for (let i = 0; i < n; i++) {
        const f = CAMERA_NEAR / -v.view[i * 3 + 2];
        target.set([c.x + (v.world[i * 3] - c.x) * f, c.y + (v.world[i * 3 + 1] - c.y) * f, c.z + (v.world[i * 3 + 2] - c.z) * f], i * 3);
      }
    }
  }

  private gizmoPose(space: Space) {
    const camera = this.engine.camera;
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    if (space === "view") {
      position.copy(camera.position);
      quaternion.copy(camera.quaternion);
    } else if (space === "screen") {
      // Pixel (0, 0) is the near plane's top-left corner; y points down.
      unprojectScreen(this.engine.transforms, this.engine.resolution, 0, 0, -1, position);
      quaternion.copy(camera.quaternion);
      scale.set(0.6, -0.6, 0.6);
    }
    return { position, quaternion, scale };
  }

  private blendedSpacePositions(from: Space, to: Space, t: number) {
    const engine = this.engine;
    const n = engine.mesh.vertexCount;
    const D = this.displayPositions;
    const pair = (a: Space, b: Space) => (from === a && to === b) || (from === b && to === a);
    if (pair("model", "world") && from !== to) {
      // Model -> world is a rotation: slerp so the head doesn't shrink half-way.
      const q = new THREE.Quaternion().slerp(engine.rotation, from === "model" ? t : 1 - t);
      const p = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        p.fromArray(engine.mesh.positions, i * 3).applyQuaternion(q);
        D.set([p.x, p.y, p.z], i * 3);
      }
      return;
    }
    const a = new Float32Array(n * 3), b = new Float32Array(n * 3);
    this.spacePositions(from, a);
    this.spacePositions(to, b);
    for (let i = 0; i < n * 3; i++) D[i] = a[i] + (b[i] - a[i]) * t;
  }

  render(theme: ThemeColors) {
    const engine = this.engine;
    const step = engine.step;
    const p = engine.entryProgress;
    this.updateObserver();
    this.renderer.setClearColor(theme.elevated);

    // Suzanne
    this.model.quaternion.copy(engine.rotation);
    const showState = step >= 1;
    if (showState && (this.stateVersion !== engine.outputVersion || this.stateStep !== step)) {
      const state = this.geometry.getAttribute("state") as THREE.BufferAttribute;
      const array = state.array as Float32Array;
      const status = engine.cull.status;
      // Step 2 reveals the culling result triangle by triangle.
      const revealed = step === 2 ? Math.floor(p * status.length) : status.length;
      for (let t = 0; t < status.length; t++) {
        const s = t < revealed ? status[t] : 0;
        array[t * 3] = array[t * 3 + 1] = array[t * 3 + 2] = s === TRI_BACK ? 1 : s === TRI_OUTSIDE ? 2 : 0;
      }
      state.needsUpdate = true;
      if (!(step === 2 && p < 1)) {
        this.stateVersion = engine.outputVersion;
        this.stateStep = step;
      }
    }
    const u = this.material.uniforms;
    u.uLight.value.copy(engine.lightDirection);
    u.uCameraPos.value.copy(this.observer.position);
    u.uShowState.value = showState ? 1 : 0;
    u.uFlat.value = step === 4 && !engine.toggles.smooth ? 1 : 0;
    u.uNormals.value = step === 4 && engine.toggles.showNormals ? 1 : 0;
    const ghost = step === 1;
    u.uOpacity.value = ghost ? 0.22 : 1;
    this.material.transparent = ghost;
    this.material.depthWrite = !ghost;

    // Scene camera and light
    this.sceneCamera.position.copy(engine.camera.position);
    this.sceneCamera.quaternion.copy(engine.camera.quaternion);
    const lightDirection = engine.lightDirection;
    this.lightGizmo.position.copy(lightDirection).multiplyScalar(3.3);
    this.lightGizmo.lookAt(0, 0, 0); // +z (the arrow) points at Suzanne

    // Vertices, coordinate spaces, projection lines (steps 0-1)
    const dotMaterial = this.vertexDots.material as THREE.PointsMaterial;
    dotMaterial.color.set(theme.text);
    dotMaterial.size = step === 0 ? 2 : 2.5;
    this.vertexDots.visible = step <= 1;
    this.projectionLines.visible = false;
    this.gizmo.group.visible = false;
    if (step === 0) {
      const m = new THREE.Matrix4().makeRotationFromQuaternion(engine.rotation);
      const v = new THREE.Vector3();
      for (let i = 0; i < engine.mesh.vertexCount; i++) {
        v.fromArray(engine.mesh.positions, i * 3).applyMatrix4(m);
        this.displayPositions.set([v.x, v.y, v.z], i * 3);
      }
      dotMaterial.opacity = 0.85 * p;
      dotMaterial.depthTest = true;
    } else if (step === 1) {
      const { from, to, t } = engine.spaceProgress();
      this.blendedSpacePositions(from, to, t);
      dotMaterial.opacity = 1;
      dotMaterial.depthTest = false;

      const a = this.gizmoPose(from), b = this.gizmoPose(to);
      this.gizmo.group.visible = true;
      this.gizmo.group.position.lerpVectors(a.position, b.position, t);
      this.gizmo.group.quaternion.slerpQuaternions(a.quaternion, b.quaternion, t);
      this.gizmo.group.scale.lerpVectors(a.scale, b.scale, t);
      setLabelText(this.gizmo.label, SPACE_LABELS[t < 0.5 ? from : to]);

      const screenWeight = (from === "screen" ? 1 - t : 0) + (to === "screen" ? t : 0);
      if (screenWeight > 0.01) {
        // A thinned-out selection of projection lines, from each vertex to its dot.
        const n = engine.mesh.vertexCount;
        const every = Math.max(1, Math.ceil(n / 160));
        const lines: number[] = [];
        const W = engine.vertices.world, D = this.displayPositions;
        for (let i = 0; i < n; i += every) lines.push(W[i * 3], W[i * 3 + 1], W[i * 3 + 2], D[i * 3], D[i * 3 + 1], D[i * 3 + 2]);
        setPoints(this.projectionLines, lines, lines.length / 3);
        (this.projectionLines.material as THREE.LineBasicMaterial).opacity = 0.4 * screenWeight;
        this.projectionLines.visible = true;
      }
    }
    if (step <= 1) setPoints(this.vertexDots, this.displayPositions, engine.mesh.vertexCount);

    // Linked highlighting
    this.updateHighlights(theme);

    this.renderer.render(this.scene, this.observer);
  }

  private updateHighlights(theme: ThemeColors) {
    const engine = this.engine;
    const display = engine.display;
    const mesh = engine.mesh;
    this.highlight.visible = this.highlightOutline.visible = false;
    this.ray.visible = this.rayHit.visible = this.pixelCell.visible = false;
    this.selectedVertex.visible = false;
    Object.values(this.arrows).forEach((arrow) => (arrow.visible = false));

    const showTriangle = (t: number, color: string) => {
      const W = engine.vertices.world;
      const corners: number[] = [];
      for (let k = 0; k < 3; k++) {
        const v = mesh.indices[t * 3 + k];
        corners.push(W[v * 3], W[v * 3 + 1], W[v * 3 + 2]);
      }
      setPoints(this.highlight, corners, 3);
      setPoints(this.highlightOutline, corners, 3);
      (this.highlight.material as THREE.MeshBasicMaterial).color.set(color);
      (this.highlightOutline.material as THREE.LineBasicMaterial).color.set(theme.text);
      this.highlight.visible = this.highlightOutline.visible = true;
    };

    // Step 3, stepping one triangle at a time: the current triangle.
    const limit = engine.step === 3 ? engine.toggles.rasterLimit : null;
    if (limit !== null && limit > 0 && limit <= engine.cull.visible.length) showTriangle(engine.cull.visible[limit - 1], theme.accent);

    if (display?.kind === "triangle") showTriangle(display.index, theme.accent);
    if (display?.kind === "vertex") {
      const i = display.index;
      setPoints(this.selectedVertex, this.displayPositions.subarray(i * 3, i * 3 + 3), 1);
      (this.selectedVertex.material as THREE.PointsMaterial).color.set(theme.accent);
      this.selectedVertex.visible = true;
    }
    if (display?.kind === "pixel") {
      const { x, y } = display;
      const t = engine.transforms, res = engine.resolution;
      // The pixel's square on the near plane...
      const cell = [
        [x, y],
        [x + 1, y],
        [x + 1, y + 1],
        [x, y + 1],
      ].flatMap(([sx, sy]) => unprojectScreen(t, res, sx, sy, -1).toArray());
      setPoints(this.pixelCell, cell, 4);
      (this.pixelCell.material as THREE.LineBasicMaterial).color.set(theme.accent);
      this.pixelCell.visible = true;
      // ...and the line from the camera through its centre to what it hits.
      const winner = engine.winnerAt(x, y);
      const end = new THREE.Vector3();
      if (winner >= 0) {
        const raster = engine.raster;
        const tri = raster.tri[winner];
        const W = engine.vertices.world;
        const [a, b, c] = [mesh.indices[tri * 3], mesh.indices[tri * 3 + 1], mesh.indices[tri * 3 + 2]];
        for (let k = 0; k < 3; k++) end.setComponent(k, raster.b0[winner] * W[a * 3 + k] + raster.b1[winner] * W[b * 3 + k] + raster.b2[winner] * W[c * 3 + k]);
        showTriangle(tri, theme.accent);
        this.rayHit.position.copy(end);
        (this.rayHit.material as THREE.MeshBasicMaterial).color.set(theme.accent);
        this.rayHit.visible = true;

        if (engine.step === 4 && engine.selection?.kind === "pixel") {
          const f = shadeFragment(mesh, engine.vertices, raster, winner, t, { smooth: engine.toggles.smooth, lightDirection: engine.lightDirection });
          const place = (arrow: THREE.ArrowHelper, direction: THREE.Vector3) => {
            arrow.position.copy(f.position);
            arrow.setDirection(direction);
            arrow.visible = true;
          };
          place(this.arrows.normal, engine.toggles.smooth ? f.normal : faceNormal(mesh, engine.vertices, tri));
          place(this.arrows.light, f.lightDirection);
          place(this.arrows.view, f.viewDirection);
        }
      } else {
        unprojectScreen(t, res, x + 0.5, y + 0.5, 1, end);
      }
      setPoints(this.ray, [...engine.camera.position.toArray(), ...end.toArray()], 2);
      (this.ray.material as THREE.LineBasicMaterial).color.set(theme.accent);
      this.ray.visible = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Final frame: the same scene, rendered by the GPU at full resolution
// ---------------------------------------------------------------------------

export class FinalFrameView {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private material = createShadingMaterial();
  private model: THREE.Mesh;

  constructor(canvas: HTMLCanvasElement, geometry: THREE.BufferGeometry) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.material.side = THREE.FrontSide; // back-face culling, like the software pipeline
    this.model = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.model);
  }

  render(engine: RasterPipelineEngine, width: number, height: number, background: string) {
    if (width < 1 || height < 1) return;
    const canvas = this.renderer.domElement;
    if (canvas.width !== Math.round(width * this.renderer.getPixelRatio()) || canvas.height !== Math.round(height * this.renderer.getPixelRatio())) {
      this.renderer.setSize(width, height, false);
    }
    this.renderer.setClearColor(background);
    this.model.quaternion.copy(engine.rotation);
    this.material.uniforms.uLight.value.copy(engine.lightDirection);
    this.material.uniforms.uCameraPos.value.copy(engine.camera.position);
    this.material.uniforms.uFlat.value = engine.toggles.smooth ? 0 : 1;
    this.renderer.render(this.scene, engine.camera);
  }

  dispose() {
    this.renderer.dispose();
  }
}

