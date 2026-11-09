/**
 * Screen view (2D) for the "Rasterization pipeline" demo: the software
 * rasterizer's output on a deliberately coarse pixel grid, drawn with
 * Canvas 2D. Each step draws the real output of its stage, with the previous
 * stage faintly underneath as a ghost layer.
 */

import { depthStage, type DepthOutput } from "./pipeline";
import type { RasterPipelineEngine } from "./engine";
import type { ThemeColors } from "./worldView";

/** The 4:3 rectangle the pixel grid occupies inside the canvas, in CSS pixels. */
export interface GridRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Grid lines are hidden once a pixel is smaller than this (CSS pixels). */
const MIN_CELL_FOR_GRID = 6;

const HEAT_COLORS: [number, number, number][] = [
  [56, 189, 120], // 1 fragment
  [250, 204, 21], // 2 fragments
  [239, 68, 68], // 3+ fragments
];

export const HEAT_LEGEND = HEAT_COLORS.map(([r, g, b], i) => ({ label: i === 2 ? "3+" : String(i + 1), color: `rgb(${r}, ${g}, ${b})` }));

const parseRgb = (css: string): [number, number, number] => {
  const m = css.match(/[\d.]+/g) ?? ["0", "0", "0"];
  return [Number(m[0]), Number(m[1]), Number(m[2])];
};

const idColorCache = new Map<number, [number, number, number]>();

/** A flat, distinct colour per triangle (golden-angle hues). */
export function idColor(t: number): [number, number, number] {
  let color = idColorCache.get(t);
  if (!color) {
    const h = (t * 137.508) % 360, s = 0.55, l = 0.58;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
    color = [f(0), f(8), f(4)];
    idColorCache.set(t, color);
  }
  return color;
}

let pixelCanvas: HTMLCanvasElement | null = null;

/** Draws a W x H RGBA buffer onto the grid with hard pixel edges. */
function blitPixels(ctx: CanvasRenderingContext2D, rect: GridRect, image: ImageData) {
  pixelCanvas ??= document.createElement("canvas");
  if (pixelCanvas.width !== image.width || pixelCanvas.height !== image.height) {
    pixelCanvas.width = image.width;
    pixelCanvas.height = image.height;
  }
  pixelCanvas.getContext("2d")!.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pixelCanvas, rect.x, rect.y, rect.w, rect.h);
}

export function drawScreen(ctx: CanvasRenderingContext2D, engine: RasterPipelineEngine, rect: GridRect, theme: ThemeColors) {
  const { width: W, height: H } = engine.resolution;
  const cell = rect.w / W;
  const step = engine.step;
  const p = engine.entryProgress;
  const toggles = engine.toggles;
  const mesh = engine.mesh;
  const S = engine.vertices.screen;
  const raster = engine.raster;
  const sx = (x: number) => rect.x + x * cell;
  const sy = (y: number) => rect.y + y * cell;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // --- Pixel colours -------------------------------------------------------
  const empty = parseRgb(theme.bg);
  const image = new ImageData(W, H);
  const data = image.data;
  for (let i = 0; i < W * H; i++) data.set([empty[0], empty[1], empty[2], 255], i * 4);
  const put = (pixel: number, rgb: ArrayLike<number>) => data.set([rgb[0], rgb[1], rgb[2], 255], pixel * 4);

  /** Fragments of the first `triangles` surviving triangles, nearest-wins (used by steps 3-4). */
  const preview = (triangles: number): DepthOutput =>
    triangles >= engine.cull.visible.length && toggles.depthTest ? engine.depth : depthStage(raster, engine.resolution, { depthTest: true, limit: raster.start[triangles] });

  let rasterTriangles = engine.cull.visible.length;
  if (step === 3) rasterTriangles = toggles.rasterLimit ?? (p < 1 ? Math.floor(p * engine.cull.visible.length) : engine.cull.visible.length);

  if (step === 3) {
    const depth = preview(rasterTriangles);
    for (let i = 0; i < W * H; i++) {
      if (toggles.overdraw && depth.overdraw[i] > 0) put(i, HEAT_COLORS[Math.min(2, depth.overdraw[i] - 1)]);
      else if (!toggles.overdraw && depth.winner[i] >= 0) put(i, idColor(raster.tri[depth.winner[i]]));
    }
  } else if (step === 4) {
    const depth = preview(engine.cull.visible.length);
    const rows = Math.ceil(p * H); // entry animation: shade scanline by scanline
    const F = toggles.showNormals ? engine.fragments.normal : engine.fragments.color;
    for (let i = 0; i < W * rows; i++) {
      const f = depth.winner[i];
      if (f < 0) continue;
      const r = F[f * 3], g = F[f * 3 + 1], b = F[f * 3 + 2];
      put(i, toggles.showNormals ? [(r * 0.5 + 0.5) * 255, (g * 0.5 + 0.5) * 255, (b * 0.5 + 0.5) * 255] : [r * 255, g * 255, b * 255]);
    }
  } else if (step >= 5) {
    // Entry animation (step 5): fragments are written one by one, in triangle order.
    const depth = step === 5 && p < 1 ? depthStage(raster, engine.resolution, { depthTest: toggles.depthTest, limit: Math.floor(p * raster.count) }) : engine.depth;
    if (step === 5 && toggles.buffer === "depth") {
      let min = 1, max = 0;
      for (let i = 0; i < W * H; i++) {
        if (depth.winner[i] < 0) continue;
        min = Math.min(min, depth.depth[i]);
        max = Math.max(max, depth.depth[i]);
      }
      // Stretched to the range in use, so Suzanne isn't one flat grey: near = light.
      const range = Math.max(1e-6, max - min);
      for (let i = 0; i < W * H; i++) {
        if (depth.winner[i] < 0) continue;
        const v = 255 * (1 - 0.85 * ((depth.depth[i] - min) / range));
        put(i, [v, v, v]);
      }
    } else {
      const C = engine.fragments.color;
      for (let i = 0; i < W * H; i++) {
        const f = depth.winner[i];
        if (f >= 0) put(i, [C[f * 3] * 255, C[f * 3 + 1] * 255, C[f * 3 + 2] * 255]);
      }
    }
  }
  blitPixels(ctx, rect, image);

  // --- Grid lines and pixel centres -----------------------------------------
  if (cell >= MIN_CELL_FOR_GRID) {
    ctx.strokeStyle = theme.border;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x++) {
      const px = Math.round(sx(x)) + 0.5;
      ctx.moveTo(px, rect.y);
      ctx.lineTo(px, rect.y + rect.h);
    }
    for (let y = 0; y <= H; y++) {
      const py = Math.round(sy(y)) + 0.5;
      ctx.moveTo(rect.x, py);
      ctx.lineTo(rect.x + rect.w, py);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (step === 3) {
      ctx.fillStyle = theme.muted;
      const d = Math.max(1.5, cell * 0.12);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ctx.fillRect(sx(x + 0.5) - d / 2, sy(y + 0.5) - d / 2, d, d);
    }
  }

  // --- Vertices and wireframe ---------------------------------------------
  const dotRadius = Math.max(1.2, Math.min(2.5, cell * 0.2));
  const drawDots = (alpha: number) => {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = theme.text;
    for (let i = 0; i < mesh.vertexCount; i++) {
      if (engine.vertices.clip[i * 4 + 3] <= 0) continue;
      ctx.fillRect(sx(S[i * 3]) - dotRadius / 2, sy(S[i * 3 + 1]) - dotRadius / 2, dotRadius, dotRadius);
    }
    ctx.globalAlpha = 1;
  };
  const drawWireframe = (alpha: number, count = engine.cull.visible.length) => {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = theme.text;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < count; k++) {
      const t = engine.cull.visible[k];
      const a = mesh.indices[t * 3], b = mesh.indices[t * 3 + 1], c = mesh.indices[t * 3 + 2];
      ctx.moveTo(sx(S[a * 3]), sy(S[a * 3 + 1]));
      ctx.lineTo(sx(S[b * 3]), sy(S[b * 3 + 1]));
      ctx.lineTo(sx(S[c * 3]), sy(S[c * 3 + 1]));
      ctx.closePath();
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  if (step === 1) {
    // Dots appear as the entry animation reaches Screen space.
    const { from, to, t } = engine.spaceProgress();
    const reached = p >= 1 ? 1 : (to === "screen" ? t : 0) + (from === "screen" ? 1 - t : 0);
    drawDots(reached);
  } else if (step === 2) {
    drawDots(0.3);
    drawWireframe(0.85, Math.floor(p * engine.cull.visible.length));
  } else if (step === 3) {
    drawWireframe(0.18);
  } else if (step === 4) {
    drawWireframe(0.08);
  }

  // --- Linked highlighting --------------------------------------------------
  const outlineCell = (x: number, y: number, width: number) => {
    ctx.lineWidth = width + 2;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
    ctx.strokeRect(sx(x), sy(y), cell, cell);
    ctx.lineWidth = width;
    ctx.strokeStyle = theme.accent;
    ctx.strokeRect(sx(x), sy(y), cell, cell);
  };
  const highlightTriangle = (t: number) => {
    const [start, end] = engine.fragmentRange(t);
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.45;
    for (let i = start; i < end; i++) ctx.fillRect(sx(raster.x[i]), sy(raster.y[i]), cell, cell);
    ctx.globalAlpha = 1;
    if (cell >= MIN_CELL_FOR_GRID) for (let i = start; i < end; i++) outlineCell(raster.x[i], raster.y[i], 1);
    // The triangle itself (dashed if it was culled and covers nothing).
    const a = mesh.indices[t * 3], b = mesh.indices[t * 3 + 1], c = mesh.indices[t * 3 + 2];
    if (engine.vertices.clip[a * 4 + 3] <= 0 || engine.vertices.clip[b * 4 + 3] <= 0 || engine.vertices.clip[c * 4 + 3] <= 0) return;
    ctx.setLineDash(end > start ? [] : [4, 3]);
    ctx.strokeStyle = theme.text;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx(S[a * 3]), sy(S[a * 3 + 1]));
    ctx.lineTo(sx(S[b * 3]), sy(S[b * 3 + 1]));
    ctx.lineTo(sx(S[c * 3]), sy(S[c * 3 + 1]));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  };

  if (step === 3 && toggles.rasterLimit !== null && toggles.rasterLimit > 0) highlightTriangle(engine.cull.visible[toggles.rasterLimit - 1]);

  const display = engine.display;
  if (display?.kind === "triangle") highlightTriangle(display.index);
  else if (display?.kind === "pixel") outlineCell(display.x, display.y, 2);
  else if (display?.kind === "vertex") {
    const i = display.index;
    ctx.lineWidth = 2;
    ctx.strokeStyle = theme.accent;
    ctx.beginPath();
    ctx.arc(sx(S[i * 3]), sy(S[i * 3 + 1]), 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Frame
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x - 0.5, rect.y - 0.5, rect.w + 1, rect.h + 1);
}
