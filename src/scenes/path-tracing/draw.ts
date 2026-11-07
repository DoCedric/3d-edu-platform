/**
 * Canvas 2D drawing for the Path Tracing Playground. Everything is laid out
 * in a fixed 800 x 530 "design" coordinate space; the caller scales the
 * context to the canvas's real pixel size.
 */

import type { Draggable, DrawnPath, PathTracingEngine } from "./engine";
import { PATH_LIFETIME } from "./engine";
import { filmPoint, HISTORY_LENGTH, toneMap, type PathRecord, type Rgb, type Vec2 } from "./pathTracer";

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 530;

/** Pixels per world unit, and where the room's top-left corner lands. */
const ROOM_SCALE = 60;
const ROOM_TOP = 18;

/** Result strip: one square per pixel. */
const STRIP = { x: 20, y: 466, w: 760, h: 760 / 48 };
const INSPECTOR = { x: 604, y: 18, w: 186 };

/** Duration of the "ray grows towards its next hit" animation in step mode. */
const STEP_GROW_MS = 450;

export interface ThemeColors {
  text: string;
  muted: string;
  accent: string;
  border: string;
  panel: string;
}

const ROOM_FLOOR = "#0b0b0f";
const WALL_GREY = "#bdbdbd";
const WALL_RED = "#e04a3c";
const WALL_BLUE = "#4777e8";
const BALL_FILL = "#e8b81c";
const BALL_SHADE = "#9c7a0c";
const LAMP_COLOR = "#fff3c4";
const AIM_CLEAR = "#ffd84a";
const AIM_BLOCKED = "#7a7a7a";

export interface Layout {
  roomLeft: number;
  toScreen: (p: Vec2) => Vec2;
  toWorld: (p: Vec2) => Vec2;
}

export function makeLayout(engine: PathTracingEngine): Layout {
  const roomW = engine.scene.roomWidth * ROOM_SCALE;
  const roomLeft = (CANVAS_WIDTH - roomW) / 2;
  return {
    roomLeft,
    toScreen: (p) => ({ x: roomLeft + p.x * ROOM_SCALE, y: ROOM_TOP + p.y * ROOM_SCALE }),
    toWorld: (p) => ({ x: (p.x - roomLeft) / ROOM_SCALE, y: (p.y - ROOM_TOP) / ROOM_SCALE }),
  };
}

// ---------------------------------------------------------------------------
// Hit testing for pixel selection
// ---------------------------------------------------------------------------

/** Which pixel (if any) is under the design-space point (x, y): the result strip or the film. */
export function pixelAt(engine: PathTracingEngine, x: number, y: number): number {
  const n = engine.pixelCount;
  if (x >= STRIP.x && x < STRIP.x + STRIP.w && y >= STRIP.y - 4 && y <= STRIP.y + STRIP.h + 4) {
    return Math.min(n - 1, Math.floor(((x - STRIP.x) / STRIP.w) * n));
  }
  const layout = makeLayout(engine);
  const cam = engine.scene.camera;
  const a = layout.toScreen(filmPoint(cam, 0, 0));
  const b = layout.toScreen(filmPoint(cam, n - 1, 1));
  if (Math.abs(y - a.y) < 14 && x >= a.x - 4 && x <= b.x + 4) {
    return Math.max(0, Math.min(n - 1, Math.floor(((x - a.x) / (b.x - a.x)) * n)));
  }
  return -1;
}

/** Which draggable object (if any) is under the design-space point (x, y). */
export function objectAt(engine: PathTracingEngine, x: number, y: number): Draggable | null {
  const p = makeLayout(engine).toWorld({ x, y });
  const { lamp, ball } = engine.scene;
  const near = (c: Vec2, r: number) => Math.hypot(p.x - c.x, p.y - c.y) <= r;
  // The lamp can be tiny, so give it a generous grab area.
  if (near(lamp.center, Math.max(lamp.radius, 0.25))) return "lamp";
  if (near(ball.center, ball.radius)) return "ball";
  return null;
}

/** Converts a design-space point to world (room) coordinates. */
export function designToWorld(engine: PathTracingEngine, x: number, y: number): Vec2 {
  return makeLayout(engine).toWorld({ x, y });
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

const toCss = (rgb: Rgb, alpha = 1) =>
  `rgba(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)}, ${alpha})`;

/** Displayable colour for a path segment: the hue of the light it carries, dimmed as it loses energy. */
function pathColor(throughput: Rgb, alpha: number): string {
  const m = Math.max(throughput[0], throughput[1], throughput[2], 1e-6);
  const k = (0.4 + 0.6 * Math.sqrt(Math.min(1, m))) / m;
  return toCss([throughput[0] * k, throughput[1] * k, throughput[2] * k], alpha);
}

/** Final display colour of a camera-mode pixel. */
export function pixelColor(engine: PathTracingEngine, pixel: number): Rgb {
  return toneMap(engine.image.average(pixel));
}

/** Calibrates light-mode brightness so it converges to roughly the camera
 * image (measured headless: the ratio is ~12,000 at the image centre). */
const LIGHT_IMAGE_SCALE = 12000;

/** Light-mode pixel colour: how much light landed in this pixel, relative to
 * ALL light paths fired. Stays dark and speckled for a long time - the point
 * of the "wasteful way". Returns null for pixels no path has reached yet. */
function lightPixelColor(engine: PathTracingEngine, pixel: number): Rgb | null {
  if (engine.lightHitCounts[pixel] === 0) return null;
  const cam = engine.scene.camera;
  // Pinhole projection: pixels towards the image edges catch less light (cos^2 falloff).
  const t = cam.tanHalfFov * (((pixel + 0.5) / engine.pixelCount) * 2 - 1);
  const k = (LIGHT_IMAGE_SCALE * (1 + t * t)) / engine.lightPaths;
  const s = engine.lightHitSums;
  return toneMap([s[pixel * 3] * k, s[pixel * 3 + 1] * k, s[pixel * 3 + 2] * k]);
}

// ---------------------------------------------------------------------------
// Main draw
// ---------------------------------------------------------------------------

export function drawFrame(ctx: CanvasRenderingContext2D, engine: PathTracingEngine, theme: ThemeColors, now: number) {
  const layout = makeLayout(engine);
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  drawRoom(ctx, engine, layout);
  drawSelectedWedge(ctx, engine, layout, theme);

  ctx.save();
  clipToRoom(ctx, engine, layout);
  if (engine.settings.showPaths && !engine.step) {
    for (const drawn of engine.drawnPaths) drawRecentPath(ctx, drawn, layout, now);
  }
  if (engine.step) drawStepPath(ctx, engine, layout, now);
  ctx.restore();

  drawCameraAndFilm(ctx, engine, layout, theme);
  drawLamp(ctx, engine, layout);
  drawRoomLabels(ctx, engine, layout, theme);
  drawStrip(ctx, engine, theme);
  drawLegend(ctx, engine, theme);
  if (engine.settings.mode === "camera") drawInspector(ctx, engine, theme);
  else drawLightInfo(ctx, engine, theme);
}

function roomRect(engine: PathTracingEngine, layout: Layout) {
  const tl = layout.toScreen({ x: 0, y: 0 });
  const br = layout.toScreen({ x: engine.scene.roomWidth, y: engine.scene.roomDepth });
  return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
}

function clipToRoom(ctx: CanvasRenderingContext2D, engine: PathTracingEngine, layout: Layout) {
  const r = roomRect(engine, layout);
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
}

function line(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawRoom(ctx: CanvasRenderingContext2D, engine: PathTracingEngine, layout: Layout) {
  const r = roomRect(engine, layout);
  ctx.fillStyle = ROOM_FLOOR;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  // Walls as thick strokes just outside the floor, in their surface colour.
  const t = 7;
  ctx.lineCap = "butt";
  ctx.lineWidth = t;
  ctx.strokeStyle = WALL_GREY;
  line(ctx, { x: r.x - t, y: r.y - t / 2 }, { x: r.x + r.w + t, y: r.y - t / 2 });
  line(ctx, { x: r.x - t, y: r.y + r.h + t / 2 }, { x: r.x + r.w + t, y: r.y + r.h + t / 2 });
  ctx.strokeStyle = WALL_RED;
  line(ctx, { x: r.x - t / 2, y: r.y }, { x: r.x - t / 2, y: r.y + r.h });
  ctx.strokeStyle = WALL_BLUE;
  line(ctx, { x: r.x + r.w + t / 2, y: r.y }, { x: r.x + r.w + t / 2, y: r.y + r.h });
  ctx.lineCap = "round";

  // The yellow ball, with a little shading so it reads as round.
  const ball = engine.scene.ball;
  const c = layout.toScreen(ball.center);
  const radius = ball.radius * ROOM_SCALE;
  const grad = ctx.createRadialGradient(c.x - radius * 0.35, c.y - radius * 0.35, radius * 0.1, c.x, c.y, radius);
  grad.addColorStop(0, "#fff1a8");
  grad.addColorStop(0.45, BALL_FILL);
  grad.addColorStop(1, BALL_SHADE);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawLamp(ctx: CanvasRenderingContext2D, engine: PathTracingEngine, layout: Layout) {
  const lamp = engine.scene.lamp;
  const c = layout.toScreen(lamp.center);
  // Draw tiny lamps at least a few pixels wide so they stay visible and grabbable.
  const r = Math.max(3, lamp.radius * ROOM_SCALE);
  // Smaller lamp = brighter per unit length, so give it a stronger glow.
  const intensity = Math.min(1, 0.12 / Math.sqrt(lamp.radius));
  ctx.save();
  ctx.shadowColor = `rgba(255, 230, 150, ${0.5 + 0.5 * intensity})`;
  ctx.shadowBlur = 12 + 24 * intensity;
  ctx.fillStyle = LAMP_COLOR;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSelectedWedge(ctx: CanvasRenderingContext2D, engine: PathTracingEngine, layout: Layout, theme: ThemeColors) {
  if (engine.selected < 0 || engine.settings.mode !== "camera") return;
  const cam = engine.scene.camera;
  const c = layout.toScreen(cam.position);
  const far = (u: number) => {
    const f = filmPoint(cam, engine.selected, u);
    const d = { x: f.x - cam.position.x, y: f.y - cam.position.y };
    return layout.toScreen({ x: cam.position.x + d.x * 8, y: cam.position.y + d.y * 8 });
  };
  ctx.save();
  clipToRoom(ctx, engine, layout);
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  const p0 = far(0);
  const p1 = far(1);
  ctx.lineTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCameraAndFilm(ctx: CanvasRenderingContext2D, engine: PathTracingEngine, layout: Layout, theme: ThemeColors) {
  const cam = engine.scene.camera;
  const n = engine.pixelCount;
  const c = layout.toScreen(cam.position);
  const left = filmPoint(cam, 0, 0);
  const right = filmPoint(cam, n - 1, 1);

  // Field of view: two faint lines from the camera through the film's ends to the back wall.
  ctx.save();
  clipToRoom(ctx, engine, layout);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 5]);
  for (const f of [left, right]) {
    const d = { x: f.x - cam.position.x, y: f.y - cam.position.y };
    line(ctx, c, layout.toScreen({ x: cam.position.x + d.x * 8, y: cam.position.y + d.y * 8 }));
  }
  ctx.setLineDash([]);
  ctx.restore();

  // Film: one cell per pixel, filled with that pixel's current colour.
  const a = layout.toScreen(left);
  const b = layout.toScreen(right);
  const cellW = (b.x - a.x) / n;
  const h = 10;
  for (let i = 0; i < n; i++) {
    const col = engine.settings.mode === "camera" ? toCss(pixelColor(engine, i)) : toCss(lightPixelColor(engine, i) ?? [0, 0, 0]);
    ctx.fillStyle = col;
    ctx.fillRect(a.x + i * cellW, a.y - h / 2, cellW + 0.5, h);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(a.x, a.y - h / 2, b.x - a.x, h);
  if (engine.selected >= 0 && engine.settings.mode === "camera") {
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(a.x + engine.selected * cellW - 1, a.y - h / 2 - 3, cellW + 2, h + 6);
  }

  // Camera body: a small rounded box with a lens nub pointing forward.
  ctx.fillStyle = "#d8d8d8";
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(c.x - 13, c.y, 26, 17, 3);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c.x - 7, c.y + 1);
  ctx.lineTo(c.x - 4, c.y - 5);
  ctx.lineTo(c.x + 4, c.y - 5);
  ctx.lineTo(c.x + 7, c.y + 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawRoomLabels(ctx: CanvasRenderingContext2D, engine: PathTracingEngine, layout: Layout, theme: ThemeColors) {
  ctx.font = "11px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textBaseline = "middle";
  const cam = engine.scene.camera;
  const c = layout.toScreen(cam.position);
  ctx.textAlign = "left";
  ctx.fillText("Camera", c.x + 18, c.y + 9);
  const filmRight = layout.toScreen(filmPoint(cam, engine.pixelCount - 1, 1));
  ctx.fillText("Film", filmRight.x + 8, filmRight.y);
  const lamp = engine.scene.lamp;
  const lampPos = layout.toScreen(lamp.center);
  ctx.textAlign = "center";
  ctx.fillStyle = LAMP_COLOR;
  ctx.fillText("Lamp", lampPos.x, lampPos.y - Math.max(3, lamp.radius * ROOM_SCALE) - 14);

  ctx.fillStyle = theme.muted;
  ctx.textAlign = "center";
  ctx.font = "10px Arial, Helvetica, sans-serif";
  const r = roomRect(engine, layout);
  ctx.fillText("The room, seen from above - drag the ball and the lamp", r.x + r.w / 2, r.y + r.h + 20);
}

function drawStrip(ctx: CanvasRenderingContext2D, engine: PathTracingEngine, theme: ThemeColors) {
  const n = engine.pixelCount;
  const cw = STRIP.w / n;
  const camera = engine.settings.mode === "camera";

  ctx.fillStyle = theme.text;
  ctx.font = "bold 12px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(
    camera ? `The image: one row of ${n} pixels (a 2D world gives a 1D image)` : "The image, built from light paths (black = no light arrived yet)",
    STRIP.x + STRIP.w / 2,
    STRIP.y - 10
  );

  for (let i = 0; i < n; i++) {
    const col = camera ? pixelColor(engine, i) : lightPixelColor(engine, i);
    ctx.fillStyle = col ? toCss(col) : "#000";
    ctx.fillRect(STRIP.x + i * cw, STRIP.y, cw, STRIP.h);
  }
  // Thin outline per pixel so individual pixels stay readable.
  ctx.strokeStyle = "rgba(128,128,128,0.35)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= n; i++) {
    const x = Math.round(STRIP.x + i * cw) + 0.5;
    line(ctx, { x, y: STRIP.y }, { x, y: STRIP.y + STRIP.h });
  }
  ctx.strokeStyle = theme.border;
  ctx.strokeRect(STRIP.x + 0.5, STRIP.y + 0.5, STRIP.w, STRIP.h);

  if (engine.selected >= 0 && camera) {
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(STRIP.x + engine.selected * cw - 1.5, STRIP.y - 4, cw + 3, STRIP.h + 8);
  }

  // Readout under the strip.
  ctx.textAlign = "center";
  ctx.fillStyle = theme.text;
  const y = STRIP.y + STRIP.h + 30;
  if (camera) {
    const target = engine.settings.sppTarget === Infinity ? "" : ` of ${engine.settings.sppTarget}`;
    ctx.font = "12px Arial, Helvetica, sans-serif";
    ctx.fillText(
      `Samples per pixel: ${engine.passes}${target}   ·   Paths traced: ${engine.cameraPaths.toLocaleString("en-US")}${engine.done ? "   ·   Done" : ""}`,
      STRIP.x + STRIP.w / 2,
      y
    );
  } else {
    const pct = engine.lightPaths ? (100 * engine.lightReached) / engine.lightPaths : 0;
    ctx.font = "bold 11px Arial, Helvetica, sans-serif";
    ctx.fillText(
      `Reached the camera: ${engine.lightReached.toLocaleString("en-US")} of ${engine.lightPaths.toLocaleString("en-US")} (${pct.toFixed(pct < 1 ? 2 : 1)}%)`,
      STRIP.x + STRIP.w / 2,
      y + 2
    );
  }
}

function drawLegend(ctx: CanvasRenderingContext2D, engine: PathTracingEngine, theme: ThemeColors) {
  const x = 16;
  let y = 30;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "bold 11px Arial, Helvetica, sans-serif";
  ctx.fillStyle = theme.text;
  ctx.fillText(engine.settings.mode === "camera" ? "Camera paths" : "Light paths", x, y);
  y += 20;

  ctx.font = "11px Arial, Helvetica, sans-serif";
  const row = (draw: () => void, label: string) => {
    draw();
    ctx.fillStyle = theme.muted;
    ctx.fillText(label, x + 34, y);
    y += 18;
  };
  const found = engine.settings.mode === "camera" ? "found light" : "reached camera";
  const lost = engine.settings.mode === "camera" ? "found no light" : "missed camera";
  row(() => {
    ctx.strokeStyle = theme.text;
    ctx.lineWidth = 2.5;
    line(ctx, { x, y }, { x: x + 26, y });
  }, found);
  row(() => {
    ctx.strokeStyle = theme.muted;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    line(ctx, { x, y }, { x: x + 26, y });
    ctx.setLineDash([]);
  }, lost);
  row(() => {
    ctx.fillStyle = theme.text;
    ctx.beginPath();
    ctx.arc(x + 13, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }, "bounce");
  if (engine.settings.aimAtLamp && engine.settings.mode === "camera") {
    row(() => {
      ctx.strokeStyle = AIM_CLEAR;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 4]);
      line(ctx, { x, y }, { x: x + 26, y });
      ctx.setLineDash([]);
    }, "aim at lamp");
  }
  y += 8;
  ctx.fillStyle = theme.muted;
  ctx.font = "10px Arial, Helvetica, sans-serif";
  wrapText(ctx, "A path's colour shows the light it carries.", x, y, 170, 14);
}

function drawInspector(ctx: CanvasRenderingContext2D, engine: PathTracingEngine, theme: ThemeColors) {
  const { x, w } = INSPECTOR;
  let y = INSPECTOR.y + 12;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const p = engine.selected;
  if (p < 0) {
    ctx.fillStyle = theme.muted;
    ctx.font = "11px Arial, Helvetica, sans-serif";
    wrapText(ctx, "Click a pixel in the image (or on the film) to look at it closer.", x, y + 8, w, 14);
    return;
  }

  ctx.fillStyle = theme.text;
  ctx.font = "bold 12px Arial, Helvetica, sans-serif";
  ctx.fillText(`Pixel ${p + 1}`, x, y);
  y += 16;

  // Big colour swatch.
  ctx.fillStyle = toCss(pixelColor(engine, p));
  ctx.fillRect(x, y, 70, 70);
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, 70, 70);
  const count = engine.image.counts[p];
  ctx.fillStyle = theme.muted;
  ctx.font = "11px Arial, Helvetica, sans-serif";
  ctx.fillText(`${count.toLocaleString("en-US")}`, x + 82, y + 24);
  ctx.fillText(count === 1 ? "sample" : "samples", x + 82, y + 44);
  y += 92;

  // Running-average graph: wobbly at first, then settling down.
  ctx.fillStyle = theme.text;
  ctx.font = "11px Arial, Helvetica, sans-serif";
  ctx.fillText("Average so far", x, y);
  y += 14;
  const gh = 130;
  ctx.fillStyle = theme.panel;
  ctx.fillRect(x, y, w, gh);
  ctx.strokeStyle = theme.border;
  ctx.strokeRect(x + 0.5, y + 0.5, w, gh);

  const shown = Math.min(count, HISTORY_LENGTH);
  if (shown > 0) {
    const hist = engine.image.history;
    const base = p * HISTORY_LENGTH;
    const px = (i: number) => x + 4 + (shown <= 1 ? 0 : (i / (shown - 1)) * (w - 8));
    const py = (v: number) => y + gh - 6 - v * (gh - 12);
    const last = hist[base + shown - 1];
    ctx.strokeStyle = theme.muted;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    line(ctx, { x, y: py(last) }, { x: x + w, y: py(last) });
    ctx.setLineDash([]);
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Downsample to at most ~1 point per screen pixel.
    const stride = Math.max(1, Math.floor(shown / w));
    for (let i = 0; i < shown; i += stride) {
      const vx = px(i);
      const vy = py(hist[base + i]);
      if (i === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }
    ctx.lineTo(px(shown - 1), py(last));
    ctx.stroke();
  }
  y += gh + 14;
  ctx.fillStyle = theme.muted;
  ctx.font = "10px Arial, Helvetica, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("samples →", x, y);
  if (count > HISTORY_LENGTH) {
    ctx.textAlign = "right";
    ctx.fillText(`first ${HISTORY_LENGTH}`, x + w, y);
  }
}

function drawLightInfo(ctx: CanvasRenderingContext2D, engine: PathTracingEngine, theme: ThemeColors) {
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = theme.muted;
  ctx.font = "11px Arial, Helvetica, sans-serif";
  wrapText(
    ctx,
    "Every path starts at the lamp. It only counts if it happens to fly into the camera's tiny lens. Nearly all of them miss.",
    INSPECTOR.x,
    INSPECTOR.y + 20,
    INSPECTOR.w,
    14
  );
  if (engine.lightPaths > 0) {
    // What the same work would have bought with camera paths.
    const perPixel = Math.floor(engine.lightPaths / engine.pixelCount);
    ctx.fillStyle = theme.text;
    wrapText(
      ctx,
      `Starting from the camera instead, the same ${engine.lightPaths.toLocaleString("en-US")} paths would give every pixel ${perPixel.toLocaleString("en-US")} samples.`,
      INSPECTOR.x,
      INSPECTOR.y + 100,
      INSPECTOR.w,
      14
    );
  }
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function drawRecentPath(ctx: CanvasRenderingContext2D, drawn: DrawnPath, layout: Layout, now: number) {
  const age = (now - drawn.born) / PATH_LIFETIME;
  const fade = Math.max(0, 1 - age);
  const rec = drawn.record;
  const alpha = rec.success ? 0.9 * fade : 0.4 * fade;
  if (alpha <= 0.01) return;

  ctx.lineWidth = rec.success ? 2 : 1.2;
  ctx.setLineDash(rec.success ? [] : [5, 5]);
  for (let i = 0; i < rec.colors.length; i++) {
    ctx.strokeStyle = pathColor(rec.colors[i], alpha);
    line(ctx, layout.toScreen(rec.points[i]), layout.toScreen(rec.points[i + 1]));
  }
  ctx.setLineDash([]);

  for (const ray of rec.shadowRays) {
    if (!ray.clear) continue;
    ctx.strokeStyle = AIM_CLEAR;
    ctx.globalAlpha = 0.35 * fade;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    line(ctx, layout.toScreen(ray.from), layout.toScreen(ray.to));
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  for (let i = 1; i < rec.points.length - (rec.success ? 1 : 0); i++) {
    const p = layout.toScreen(rec.points[i]);
    ctx.fillStyle = pathColor(rec.colors[i - 1], alpha);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStepPath(ctx: CanvasRenderingContext2D, engine: PathTracingEngine, layout: Layout, now: number) {
  const step = engine.step!;
  const rec: PathRecord = step.record;
  const event = rec.events[step.eventIndex];
  const prevVertices = step.eventIndex > 0 ? rec.events[step.eventIndex - 1].vertices : 1;
  const grow = Math.min(1, (now - step.eventStart) / STEP_GROW_MS);
  const finished = step.eventIndex === rec.events.length - 1;

  ctx.lineWidth = 3.5;
  for (let i = 0; i < event.vertices - 1; i++) {
    const a = layout.toScreen(rec.points[i]);
    let b = layout.toScreen(rec.points[i + 1]);
    // The newest segment grows from its start towards the hit point.
    if (i + 1 >= prevVertices && event.vertices > prevVertices) {
      b = { x: a.x + (b.x - a.x) * easeOut(grow), y: a.y + (b.y - a.y) * easeOut(grow) };
    }
    ctx.strokeStyle = pathColor(rec.colors[i], 1);
    ctx.setLineDash(finished && !rec.success ? [7, 6] : []);
    line(ctx, a, b);
    ctx.setLineDash([]);
  }

  // Shadow rays revealed so far.
  for (let e = 0; e <= step.eventIndex; e++) {
    const ev = rec.events[e];
    if (ev.kind !== "aim" || ev.shadowRay === undefined) continue;
    const ray = rec.shadowRays[ev.shadowRay];
    const from = layout.toScreen(ray.from);
    const to = layout.toScreen(ray.to);
    ctx.strokeStyle = ray.clear ? AIM_CLEAR : AIM_BLOCKED;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 5]);
    line(ctx, from, to);
    ctx.setLineDash([]);
    ctx.fillStyle = ray.clear ? AIM_CLEAR : AIM_BLOCKED;
    ctx.beginPath();
    ctx.arc(to.x, to.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bounce points.
  const revealed = grow >= 1 ? event.vertices : Math.max(1, event.vertices - 1);
  for (let i = 1; i < revealed; i++) {
    const p = layout.toScreen(rec.points[i]);
    ctx.fillStyle = pathColor(rec.colors[i - 1], 1);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Pulsing ring on the current point, and an arrow for "picks a direction".
  const current = layout.toScreen(rec.points[event.vertices - 1]);
  if (grow >= 1) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 180);
    ctx.strokeStyle = `rgba(255,255,255,${0.4 + 0.5 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(current.x, current.y, 10 + 3 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (event.direction) {
    const len = 48;
    const tip = { x: current.x + event.direction.x * len, y: current.y + event.direction.y * len };
    // Colour of the light carried onwards (after a hit it already includes that surface's colour).
    const next = rec.colors[event.vertices - 1] ?? ([1, 1, 1] as Rgb);
    drawArrow(ctx, current, tip, pathColor(next, 1));
  }
}

function drawArrow(ctx: CanvasRenderingContext2D, from: Vec2, to: Vec2, color: string) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 4]);
  line(ctx, from, to);
  ctx.setLineDash([]);
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - 11 * Math.cos(ang - 0.45), to.y - 11 * Math.sin(ang - 0.45));
  ctx.lineTo(to.x - 11 * Math.cos(ang + 0.45), to.y - 11 * Math.sin(ang + 0.45));
  ctx.closePath();
  ctx.fill();
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  let lineText = "";
  for (const word of text.split(" ")) {
    const test = lineText ? `${lineText} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && lineText) {
      ctx.fillText(lineText, x, y);
      lineText = word;
      y += lineHeight;
    } else {
      lineText = test;
    }
  }
  if (lineText) ctx.fillText(lineText, x, y);
}
