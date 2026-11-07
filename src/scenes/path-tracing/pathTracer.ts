/**
 * Path tracing core for the 2D "Path Tracing Playground" demo.
 *
 * Pure TypeScript with no React, DOM, or canvas dependencies, so it can be
 * reused or tested headless. The world is a flat, top-down 2D room, which
 * makes the image a single row of pixels.
 *
 * World coordinates: x runs right and y runs DOWN (same as the screen), so the
 * back wall is at y = 0 (top of the screen) and the camera sits near the
 * bottom looking "up" (towards -y).
 *
 * The physics is honest flatland light transport:
 *  - Lambertian (matte) surfaces. In 2D the diffuse BRDF is albedo / 2,
 *    because the integral of cos(theta) over a half-circle is 2.
 *  - Cosine-weighted bounce directions: sin(theta) uniform in [-1, 1] gives
 *    pdf = cos(theta) / 2, so BRDF * cos / pdf = albedo. Each bounce simply
 *    multiplies the path's throughput by the surface colour.
 *  - Optional next event estimation (aiming at the lamp). In 2D the
 *    geometry term is cosSurface * cosLamp / distance (not distance^2).
 */

// ---------------------------------------------------------------------------
// Small vector / colour helpers
// ---------------------------------------------------------------------------

export interface Vec2 {
  x: number;
  y: number;
}

export type Rgb = [number, number, number];

const v = (x: number, y: number): Vec2 => ({ x, y });
const sub = (a: Vec2, b: Vec2): Vec2 => v(a.x - b.x, a.y - b.y);
const add = (a: Vec2, b: Vec2): Vec2 => v(a.x + b.x, a.y + b.y);
const scale = (a: Vec2, s: number): Vec2 => v(a.x * s, a.y * s);
const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
const normalize = (a: Vec2): Vec2 => scale(a, 1 / Math.hypot(a.x, a.y));

/** Small offset used to keep rays from re-hitting the surface they start on. */
const EPS = 1e-6;

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export type SurfaceKind = "wall" | "ball" | "lamp";

/** What a ray can hit, independent of its shape. */
export interface Surface {
  albedo: Rgb;
  kind: SurfaceKind;
  /** Short name used in step-by-step captions, e.g. "the red wall". */
  name: string;
  /** How the light it carries changes, for captions, e.g. "turns red". */
  tintWord: string;
}

export interface Segment extends Surface {
  a: Vec2;
  b: Vec2;
  /** Unit normal facing into the room. */
  normal: Vec2;
}

/** A sphere - in a 2D world, a circle. */
export interface Ball extends Surface {
  center: Vec2;
  radius: number;
}

export interface Camera {
  position: Vec2;
  /** Unit view direction. */
  forward: Vec2;
  /** Unit vector pointing to the right of the image. */
  right: Vec2;
  /** tan(fov / 2). */
  tanHalfFov: number;
  /** Distance from the camera to the (drawn) film. Purely visual for a pinhole camera. */
  filmDistance: number;
  pixelCount: number;
  /** Half-width of the lens opening, used only by light-path mode. */
  lensHalfWidth: number;
}

/** The parts of the scene the user can change: lamp size and where the two balls are. */
export interface SceneParams {
  lampRadius: number;
  lampCenter: Vec2;
  ballCenter: Vec2;
}

export interface Scene {
  walls: Segment[];
  /** The yellow ball and the lamp. */
  balls: Ball[];
  ball: Ball;
  lamp: Ball;
  /** Emitted radiance of the lamp's surface (per unit length, per direction). */
  lampEmission: Rgb;
  camera: Camera;
  roomWidth: number;
  roomDepth: number;
}

export const ROOM_WIDTH = 6;
export const ROOM_DEPTH = 6.6;
export const PIXEL_COUNT = 48;
export const LAMP_MIN_RADIUS = 0.012;
export const LAMP_MAX_RADIUS = 0.75;
export const BALL_RADIUS = 0.45;

/** Default layout: the lamp sits low and to the left of the camera, so the
 * ball throws its shadow up and to the right onto the back wall - the wall
 * the camera looks at - instead of hiding the shadow behind itself. */
export const DEFAULT_PARAMS: SceneParams = {
  lampRadius: 0.3,
  lampCenter: { x: 1.1, y: 5.6 },
  ballCenter: { x: 2.0, y: 2.7 },
};

/** Total lamp power. Kept constant when the lamp is resized, so a tiny lamp
 * is very bright per unit length - that is what produces fireflies. */
const LAMP_POWER = 6;
const LAMP_COLOR: Rgb = [1, 0.93, 0.8];

const GREY: Rgb = [0.75, 0.75, 0.75];
// Red / blue instead of the classic red / green: friendlier for colour-blind students.
const RED: Rgb = [0.85, 0.14, 0.1];
const BLUE: Rgb = [0.12, 0.3, 0.88];
const YELLOW: Rgb = [0.9, 0.72, 0.1];

const CAMERA_POSITION = v(ROOM_WIDTH / 2, ROOM_DEPTH - 0.9);

function wall(a: Vec2, b: Vec2, normal: Vec2, albedo: Rgb, name: string, tintWord: string): Segment {
  return { a, b, normal, albedo, kind: "wall", name, tintWord };
}

export function buildScene(params: SceneParams): Scene {
  const W = ROOM_WIDTH;
  const D = ROOM_DEPTH;
  const grey = "gets a bit darker";
  const walls: Segment[] = [
    wall(v(0, 0), v(W, 0), v(0, 1), GREY, "the back wall", grey),
    wall(v(0, 0), v(0, D), v(1, 0), RED, "the red wall", "turns red"),
    wall(v(W, 0), v(W, D), v(-1, 0), BLUE, "the blue wall", "turns blue"),
    wall(v(0, D), v(W, D), v(0, -1), GREY, "the front wall", grey),
  ];
  const ball: Ball = {
    center: params.ballCenter,
    radius: BALL_RADIUS,
    albedo: YELLOW,
    kind: "ball",
    name: "the yellow ball",
    tintWord: "turns yellow",
  };
  const lamp: Ball = { center: params.lampCenter, radius: params.lampRadius, albedo: [0, 0, 0], kind: "lamp", name: "the lamp", tintWord: "" };

  // The power is spread over the lamp's whole outline (2 * pi * r).
  const radiance = LAMP_POWER / (2 * Math.PI * params.lampRadius);
  return {
    walls,
    balls: [ball, lamp],
    ball,
    lamp,
    lampEmission: [LAMP_COLOR[0] * radiance, LAMP_COLOR[1] * radiance, LAMP_COLOR[2] * radiance],
    camera: {
      position: CAMERA_POSITION,
      forward: v(0, -1),
      right: v(1, 0),
      tanHalfFov: Math.tan((35 * Math.PI) / 180), // 70 degree field of view
      filmDistance: 1.5,
      pixelCount: PIXEL_COUNT,
      lensHalfWidth: 0.012,
    },
    roomWidth: W,
    roomDepth: D,
  };
}

/**
 * Where a dragged ball may go: inside the room, not on top of the camera,
 * and not overlapping the other ball. Returns the closest allowed position.
 */
export function constrainBall(pos: Vec2, radius: number, other: { center: Vec2; radius: number }): Vec2 {
  let p = pos;
  const pushOut = (c: Vec2, minDist: number) => {
    const d = sub(p, c);
    const len = Math.hypot(d.x, d.y);
    if (len >= minDist) return;
    p = len < 1e-6 ? add(c, v(0, -minDist)) : add(c, scale(d, minDist / len));
  };
  for (let i = 0; i < 4; i++) {
    pushOut(CAMERA_POSITION, radius + 0.25);
    pushOut(other.center, radius + other.radius + 0.05);
    const m = radius + 0.05;
    p = v(Math.min(ROOM_WIDTH - m, Math.max(m, p.x)), Math.min(ROOM_DEPTH - m, Math.max(m, p.y)));
  }
  return p;
}

// ---------------------------------------------------------------------------
// Geometry queries
// ---------------------------------------------------------------------------

export interface Hit {
  t: number;
  point: Vec2;
  /** Unit normal of the surface at the hit point (into the room / out of the ball). */
  normal: Vec2;
  surface: Surface;
}

/** Closest intersection of the ray o + t*d (t > EPS) with the scene. */
export function intersect(scene: Scene, o: Vec2, d: Vec2): Hit | null {
  let bestT = Infinity;
  let best: Segment | Ball | null = null;
  for (const seg of scene.walls) {
    const t = raySegment(o, d, seg.a, seg.b);
    if (t > EPS && t < bestT) {
      bestT = t;
      best = seg;
    }
  }
  for (const ball of scene.balls) {
    const t = rayCircle(o, d, ball.center, ball.radius);
    if (t > EPS && t < bestT) {
      bestT = t;
      best = ball;
    }
  }
  if (!best) return null;
  const point = add(o, scale(d, bestT));
  const normal = "center" in best ? scale(sub(point, best.center), 1 / best.radius) : best.normal;
  return { t: bestT, point, normal, surface: best };
}

/** Ray parameter t where o + t*d crosses segment ab, or -1 if it misses. */
function raySegment(o: Vec2, d: Vec2, a: Vec2, b: Vec2): number {
  const e = sub(b, a);
  const denom = cross(d, e);
  if (Math.abs(denom) < 1e-12) return -1; // parallel
  const w = sub(a, o);
  const t = cross(w, e) / denom;
  const u = cross(w, d) / denom;
  return u >= 0 && u <= 1 ? t : -1;
}

/** First ray parameter t > EPS where o + t*d (unit d) meets the circle, or -1. */
function rayCircle(o: Vec2, d: Vec2, c: Vec2, r: number): number {
  const oc = sub(o, c);
  const b = dot(oc, d);
  const disc = b * b - (dot(oc, oc) - r * r);
  if (disc < 0) return -1;
  const sq = Math.sqrt(disc);
  if (-b - sq > EPS) return -b - sq;
  if (-b + sq > EPS) return -b + sq;
  return -1;
}

/** Cosine-weighted random direction around unit normal n (2D version:
 * sin(theta) uniform in [-1, 1], theta measured from the normal). */
export function sampleCosine(n: Vec2, random: () => number): Vec2 {
  const s = 2 * random() - 1;
  const c = Math.sqrt(1 - s * s);
  const tangent = v(-n.y, n.x);
  return add(scale(n, c), scale(tangent, s));
}

/** Point on the film for pixel `pixel` at fractional position `u` in [0, 1) within the cell. */
export function filmPoint(camera: Camera, pixel: number, u: number): Vec2 {
  const halfWidth = camera.filmDistance * camera.tanHalfFov;
  const s = -halfWidth + ((pixel + u) / camera.pixelCount) * 2 * halfWidth;
  return add(add(camera.position, scale(camera.forward, camera.filmDistance)), scale(camera.right, s));
}

/** Which pixel a world-space direction (from the camera outwards) lands in, or -1 if outside the view. */
export function pixelForDirection(camera: Camera, dir: Vec2): number {
  const f = dot(dir, camera.forward);
  if (f <= 0) return -1;
  const s = dot(dir, camera.right) / f / camera.tanHalfFov; // -1..1 across the image
  if (s < -1 || s >= 1) return -1;
  return Math.floor(((s + 1) / 2) * camera.pixelCount);
}

// ---------------------------------------------------------------------------
// Path records (for drawing and for the step-by-step mode)
// ---------------------------------------------------------------------------

export type PathEventKind = "start" | "hit" | "aim" | "bounce" | "light" | "camera" | "dead";

export interface PathEvent {
  kind: PathEventKind;
  /** Number of path vertices visible once this event is shown. */
  vertices: number;
  caption: string;
  /** For "bounce" / "start": the direction about to be taken, drawn as an arrow. */
  direction?: Vec2;
  /** For "aim": index into shadowRays. */
  shadowRay?: number;
}

export interface ShadowRay {
  from: Vec2;
  to: Vec2;
  clear: boolean;
}

export interface PathRecord {
  /** Vertex 0 is the camera (camera paths) or a point on the lamp (light paths). */
  points: Vec2[];
  /** Colour carried along segment i (points[i] -> points[i + 1]), as throughput. */
  colors: Rgb[];
  /** True if the path delivered light (camera paths) or reached the camera (light paths). */
  success: boolean;
  /** Pixel the path belongs to, or -1. */
  pixel: number;
  shadowRays: ShadowRay[];
  events: PathEvent[];
}

// ---------------------------------------------------------------------------
// Tracing
// ---------------------------------------------------------------------------

export interface TraceOptions {
  maxBounces: number;
  /** Next event estimation: also aim at the lamp at each bounce. */
  aimAtLamp: boolean;
  random?: () => number;
}

export interface CameraSample {
  pixel: number;
  radiance: Rgb;
  path: PathRecord | null;
}

/** True if nothing but the lamp is on the straight line from p (along unit dir) for `dist`. */
function unoccluded(scene: Scene, p: Vec2, dir: Vec2, dist: number): boolean {
  for (const seg of scene.walls) {
    const t = raySegment(p, dir, seg.a, seg.b);
    if (t > EPS && t < dist - 1e-4) return false;
  }
  for (const ball of scene.balls) {
    if (ball.kind === "lamp") continue;
    const t = rayCircle(p, dir, ball.center, ball.radius);
    if (t > EPS && t < dist - 1e-4) return false;
  }
  return true;
}

const faceForward = (n: Vec2, d: Vec2): Vec2 => (dot(n, d) > 0 ? scale(n, -1) : n);

/**
 * Traces one camera path through `pixel` and returns the light it brings back.
 * When `record` is true the full path (vertices, colours, captions) is
 * returned too; otherwise `path` is null to keep the hot loop allocation-light.
 */
export function traceCameraPath(scene: Scene, pixel: number, options: TraceOptions, record: boolean): CameraSample {
  const random = options.random ?? Math.random;
  const cam = scene.camera;
  const radiance: Rgb = [0, 0, 0];
  let throughput: Rgb = [1, 1, 1];

  let origin = cam.position;
  let dir = normalize(sub(filmPoint(cam, pixel, random()), origin));

  const path: PathRecord | null = record
    ? { points: [origin], colors: [], success: false, pixel, shadowRays: [], events: [] }
    : null;
  path?.events.push({ kind: "start", vertices: 1, direction: dir, caption: `A ray leaves the camera through pixel ${pixel + 1}.` });

  for (let surfaceHits = 0; ; ) {
    const hit = intersect(scene, origin, dir);
    if (!hit) break; // cannot happen in a closed room, but stay safe
    if (path) {
      path.points.push(hit.point);
      path.colors.push([...throughput]);
    }
    const n = path ? path.points.length : 0;
    const seg = hit.surface;

    if (seg.kind === "lamp") {
      // With "aim at the lamp" on, light reaching the lamp after a bounce was
      // already counted by that bounce's aim - adding it again would double count.
      if (surfaceHits === 0 || !options.aimAtLamp) {
        for (let c = 0; c < 3; c++) radiance[c] += throughput[c] * scene.lampEmission[c];
        path?.events.push({ kind: "light", vertices: n, caption: "It reaches the lamp: this pixel gets some light!" });
      } else {
        path?.events.push({
          kind: "dead",
          vertices: n,
          caption: "It reaches the lamp, but this light was already counted when it aimed at the lamp.",
        });
      }
      break;
    }

    if (surfaceHits >= options.maxBounces) {
      path?.events.push({
        kind: "dead",
        vertices: n,
        caption:
          options.maxBounces === 0
            ? `It hits ${seg.name}, but no bounces are allowed. ${radiance[0] + radiance[1] + radiance[2] > 0 ? "" : "Black for this sample."}`
            : `It hits ${seg.name}, but it has no bounces left. ${radiance[0] + radiance[1] + radiance[2] > 0 ? "Done." : "This path found no light: black for this sample."}`,
      });
      break;
    }

    // Diffuse bounce: the carried light takes on the surface colour.
    surfaceHits++;
    throughput = [throughput[0] * seg.albedo[0], throughput[1] * seg.albedo[1], throughput[2] * seg.albedo[2]];
    path?.events.push({ kind: "hit", vertices: n, caption: `It hits ${seg.name}: the light it carries ${seg.tintWord}.` });

    const normal = faceForward(hit.normal, dir);
    const p = add(hit.point, scale(normal, 1e-5));

    if (options.aimAtLamp) {
      // Pick a random point on the half of the lamp that faces this point
      // (the far half can never be seen from here) and check if it is visible.
      const lamp = scene.lamp;
      const facing = Math.atan2(p.y - lamp.center.y, p.x - lamp.center.x);
      const angle = facing + (random() - 0.5) * Math.PI;
      const lampNormal = v(Math.cos(angle), Math.sin(angle));
      const q = add(lamp.center, scale(lampNormal, lamp.radius));
      const toLamp = sub(q, p);
      const dist = Math.hypot(toLamp.x, toLamp.y);
      const wl = scale(toLamp, 1 / dist);
      const cosSurface = dot(normal, wl);
      const cosLamp = -dot(lampNormal, wl);
      const clear = cosSurface > 0 && cosLamp > 0 && unoccluded(scene, p, wl, dist);
      if (clear) {
        // throughput already includes the albedo; the remaining 1/2 is the 2D
        // diffuse BRDF. pi * r undoes the pdf of picking a point on the half circle.
        const g = (cosSurface * cosLamp * Math.PI * lamp.radius) / (2 * dist);
        for (let c = 0; c < 3; c++) radiance[c] += throughput[c] * scene.lampEmission[c] * g;
      }
      if (path) {
        path.shadowRays.push({ from: hit.point, to: q, clear });
        path.events.push({
          kind: "aim",
          vertices: n,
          shadowRay: path.shadowRays.length - 1,
          caption: clear
            ? "It aims at the lamp: nothing in the way, so this pixel gets some light."
            : "It aims at the lamp, but something blocks it: no light from this bounce.",
        });
      }
    }

    origin = p;
    dir = sampleCosine(normal, random);
    path?.events.push({ kind: "bounce", vertices: n, direction: dir, caption: "It picks a random new direction." });
  }

  if (path) {
    path.success = radiance[0] + radiance[1] + radiance[2] > 0;
    if (!path.success && path.events[path.events.length - 1].kind !== "dead") {
      path.events.push({ kind: "dead", vertices: path.points.length, caption: "This path found no light: black for this sample." });
    }
  }
  return { pixel, radiance, path };
}

export interface LightSample {
  /** Pixel the light landed in if it reached the camera, else -1. */
  pixel: number;
  /** Colour the light carried when it arrived (only meaningful if pixel >= 0). */
  color: Rgb;
  path: PathRecord | null;
}

/** Ray parameter where o + t*d passes through the camera lens (a tiny opening
 * across the camera position), arriving from inside the field of view; -1 otherwise. */
function lensCrossing(cam: Camera, o: Vec2, d: Vec2): number {
  const incoming = scale(d, -1); // direction from the camera back towards where the light came from
  if (pixelForDirection(cam, incoming) < 0) return -1;
  const a = add(cam.position, scale(cam.right, -cam.lensHalfWidth));
  const b = add(cam.position, scale(cam.right, cam.lensHalfWidth));
  return raySegment(o, d, a, b);
}

/** Traces one path FROM the lamp ("the wasteful way") and reports whether it reached the camera. */
export function traceLightPath(scene: Scene, options: TraceOptions, record: boolean): LightSample {
  const random = options.random ?? Math.random;
  const lamp = scene.lamp;
  const cam = scene.camera;
  const angle = random() * 2 * Math.PI;
  const lampNormal = v(Math.cos(angle), Math.sin(angle));
  let origin = add(lamp.center, scale(lampNormal, lamp.radius + 1e-5));
  let dir = sampleCosine(lampNormal, random);
  let throughput: Rgb = [...LAMP_COLOR];

  const path: PathRecord | null = record
    ? { points: [origin], colors: [], success: false, pixel: -1, shadowRays: [], events: [] }
    : null;
  path?.events.push({ kind: "start", vertices: 1, direction: dir, caption: "Light leaves the lamp in a random direction." });

  for (let surfaceHits = 0; ; ) {
    const hit = intersect(scene, origin, dir);
    if (!hit) break;
    const tLens = lensCrossing(cam, origin, dir);
    if (tLens > EPS && tLens < hit.t) {
      const pixel = pixelForDirection(cam, scale(dir, -1));
      if (path) {
        path.points.push(cam.position);
        path.colors.push([...throughput]);
        path.success = true;
        path.pixel = pixel;
        path.events.push({ kind: "camera", vertices: path.points.length, caption: "It goes straight into the camera's lens. Lucky - this one counts!" });
      }
      return { pixel, color: throughput, path };
    }

    if (path) {
      path.points.push(hit.point);
      path.colors.push([...throughput]);
    }
    const n = path ? path.points.length : 0;
    const seg = hit.surface;

    if (seg.kind === "lamp" || surfaceHits >= options.maxBounces) {
      path?.events.push({
        kind: "dead",
        vertices: n,
        caption: `It hits ${seg.name} and stops. It never reached the camera: wasted work.`,
      });
      break;
    }

    surfaceHits++;
    throughput = [throughput[0] * seg.albedo[0], throughput[1] * seg.albedo[1], throughput[2] * seg.albedo[2]];
    path?.events.push({ kind: "hit", vertices: n, caption: `It hits ${seg.name}: the light ${seg.tintWord}.` });
    const normal = faceForward(hit.normal, dir);
    origin = add(hit.point, scale(normal, 1e-5));
    dir = sampleCosine(normal, random);
    path?.events.push({ kind: "bounce", vertices: n, direction: dir, caption: "It bounces off in a random new direction." });
  }
  return { pixel: -1, color: throughput, path };
}

// ---------------------------------------------------------------------------
// Image accumulation and display
// ---------------------------------------------------------------------------

/** How many running-average values per pixel are kept for the convergence graph. */
export const HISTORY_LENGTH = 1024;

/** Running per-pixel sums. Displayed value = sum / count, then tone mapped. */
export class Accumulator {
  readonly pixelCount: number;
  readonly sums: Float64Array;
  readonly counts: Uint32Array;
  /** Brightness (0..1, tone mapped) of each pixel's running average after each of its first HISTORY_LENGTH samples. */
  readonly history: Float32Array;

  constructor(pixelCount: number) {
    this.pixelCount = pixelCount;
    this.sums = new Float64Array(pixelCount * 3);
    this.counts = new Uint32Array(pixelCount);
    this.history = new Float32Array(pixelCount * HISTORY_LENGTH);
  }

  reset() {
    this.sums.fill(0);
    this.counts.fill(0);
    this.history.fill(0);
  }

  add(pixel: number, rgb: Rgb) {
    const i = pixel * 3;
    this.sums[i] += rgb[0];
    this.sums[i + 1] += rgb[1];
    this.sums[i + 2] += rgb[2];
    const count = ++this.counts[pixel];
    if (count <= HISTORY_LENGTH) {
      const avg = this.average(pixel);
      this.history[pixel * HISTORY_LENGTH + count - 1] = brightness(avg);
    }
  }

  average(pixel: number): Rgb {
    const n = this.counts[pixel];
    if (n === 0) return [0, 0, 0];
    const i = pixel * 3;
    return [this.sums[i] / n, this.sums[i + 1] / n, this.sums[i + 2] / n];
  }
}

/** Simple tone mapping (x / (1 + x)) followed by gamma 2.2, per channel. Output 0..1. */
export function toneMap(rgb: Rgb): Rgb {
  return [display(rgb[0]), display(rgb[1]), display(rgb[2])];
}

function display(x: number): number {
  return Math.pow(x / (1 + x), 1 / 2.2);
}

/** Single 0..1 brightness value for the convergence graph. */
export function brightness(rgb: Rgb): number {
  return display(0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]);
}
