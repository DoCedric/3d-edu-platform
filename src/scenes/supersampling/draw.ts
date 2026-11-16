import { inside, RESOLUTION, samplesPerSide, tracePath, type SampleCount, type ShapeId } from "./raster";

export interface ThemeColors {
  bg: string;
  elevated: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
}

export interface SceneState {
  shape: ShapeId;
  angle: number;
  rasterize: boolean;
  samples: SampleCount;
  grid: boolean;
}

/** Maps framebuffer coordinates to CSS pixels: screen = origin + fb * scale. */
export interface ViewTransform {
  scale: number;
  ox: number;
  oy: number;
}

// Below these on-screen sizes (CSS px) a layer would be too dense to read.
const MIN_PIXEL_LINES = 3;
const MIN_SAMPLE_LINES = 5;
const MIN_SAMPLE_DOTS = 7;
const MIN_OUTLINE = 8;

/** Parses "rgb(r, g, b)" from readTheme. */
export function parseRgb(color: string): [number, number, number] {
  const [r, g, b] = color.match(/\d+/g)!.map(Number);
  return [r, g, b];
}

/** Writes the resolved framebuffer into a RESOLUTION x RESOLUTION canvas:
 * each pixel blends background and shape colour by its coverage. */
export function paintFramebuffer(target: HTMLCanvasElement, coverage: Float32Array, theme: ThemeColors) {
  const ctx = target.getContext("2d")!;
  const image = ctx.createImageData(RESOLUTION, RESOLUTION);
  const bg = parseRgb(theme.bg), fg = parseRgb(theme.text);
  for (let i = 0; i < coverage.length; i++) {
    const c = coverage[i];
    for (let k = 0; k < 3; k++) image.data[i * 4 + k] = bg[k] + (fg[k] - bg[k]) * c;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: SceneState,
  view: ViewTransform,
  framebuffer: HTMLCanvasElement,
  theme: ThemeColors
) {
  const { scale, ox, oy } = view;
  const size = RESOLUTION * scale;

  ctx.fillStyle = theme.elevated;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = theme.bg;
  ctx.fillRect(ox, oy, size, size);

  // The image itself: the exact shape, or the 64 x 64 framebuffer blown up
  // with hard pixel edges.
  if (state.rasterize) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(framebuffer, ox, oy, size, size);
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, size, size);
    ctx.clip();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    tracePath(ctx, state.shape, state.angle);
    ctx.fillStyle = theme.text;
    ctx.fill();
    ctx.restore();
  }

  if (state.grid) drawGrid(ctx, width, height, state, view, theme);

  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(ox - 0.5, oy - 0.5, size + 1, size + 1);
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, state: SceneState, view: ViewTransform, theme: ThemeColors) {
  const { scale, ox, oy } = view;
  const n = samplesPerSide(state.samples);
  const sub = scale / n;

  // Only the pixels that are on screen.
  const x0 = Math.max(0, Math.floor(-ox / scale)), x1 = Math.min(RESOLUTION, Math.ceil((width - ox) / scale));
  const y0 = Math.max(0, Math.floor(-oy / scale)), y1 = Math.min(RESOLUTION, Math.ceil((height - oy) / scale));
  if (x0 >= x1 || y0 >= y1) return;
  const left = ox + x0 * scale, right = ox + x1 * scale, top = oy + y0 * scale, bottom = oy + y1 * scale;

  const lines = (step: number, from: number, to: number, origin: number, vertical: boolean, skipEvery: number) => {
    for (let i = from; i <= to; i++) {
      if (skipEvery && i % skipEvery === 0) continue;
      const p = origin + i * step;
      if (vertical) {
        ctx.moveTo(p, top);
        ctx.lineTo(p, bottom);
      } else {
        ctx.moveTo(left, p);
        ctx.lineTo(right, p);
      }
    }
  };

  ctx.save();
  ctx.strokeStyle = theme.muted;

  // Thin lines between samples inside each pixel.
  if (n > 1 && sub >= MIN_SAMPLE_LINES) {
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    ctx.beginPath();
    lines(sub, x0 * n, x1 * n, ox, true, n);
    lines(sub, y0 * n, y1 * n, oy, false, n);
    ctx.stroke();
  }

  // Thick lines between pixels.
  if (scale >= MIN_PIXEL_LINES) {
    ctx.globalAlpha = scale >= 10 ? 0.9 : 0.5;
    ctx.lineWidth = scale >= 24 ? 2.5 : scale >= 10 ? 1.5 : 1;
    ctx.beginPath();
    lines(scale, x0, x1, ox, true, 0);
    lines(scale, y0, y1, oy, false, 0);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Sample points: filled where the sample is inside the shape, hollow where
  // it misses. The pixel's colour is the share of filled dots.
  if (sub >= MIN_SAMPLE_DOTS) {
    const r = Math.min(sub * 0.18, 5);
    const hit = new Path2D(), miss = new Path2D();
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        for (let j = 0; j < n; j++) {
          for (let i = 0; i < n; i++) {
            const fx = px + (i + 0.5) / n, fy = py + (j + 0.5) / n;
            const sx = ox + fx * scale, sy = oy + fy * scale;
            const path = inside(state.shape, state.angle, fx, fy) ? hit : miss;
            path.moveTo(sx + r, sy);
            path.arc(sx, sy, r, 0, Math.PI * 2);
          }
        }
      }
    }
    ctx.fillStyle = theme.accent;
    ctx.fill(hit);
    ctx.lineWidth = Math.max(1, r * 0.4);
    ctx.strokeStyle = theme.bg;
    ctx.stroke(hit);
    ctx.strokeStyle = theme.accent;
    ctx.globalAlpha = 0.8;
    ctx.stroke(miss);
    ctx.globalAlpha = 1;
  }

  // The exact edge on top of the pixels, to compare against (once the
  // pixels are big enough that it doesn't hide the staircase).
  if (state.rasterize && scale >= MIN_OUTLINE) {
    // The path keeps the transform it was traced with, so restoring before
    // stroking gives a constant line width.
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    tracePath(ctx, state.shape, state.angle);
    ctx.restore();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

/** Draws the framebuffer at a small integer device-pixel scale (how the
 * 64 x 64 image really looks on screen), with the zoomed region outlined.
 * The caller's transform must be the identity (device pixels). */
export function drawThumbnail(
  ctx: CanvasRenderingContext2D,
  framebuffer: HTMLCanvasElement,
  x: number,
  y: number,
  pixelSize: number,
  visible: { x: number; y: number; w: number; h: number } | null,
  theme: ThemeColors,
  dpr: number
) {
  const size = RESOLUTION * pixelSize;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(framebuffer, x, y, size, size);
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = dpr;
  ctx.strokeRect(x - dpr / 2, y - dpr / 2, size + dpr, size + dpr);
  if (visible) {
    const vx = Math.max(0, visible.x), vy = Math.max(0, visible.y);
    const vw = Math.min(RESOLUTION, visible.x + visible.w) - vx, vh = Math.min(RESOLUTION, visible.y + visible.h) - vy;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeRect(x + vx * pixelSize, y + vy * pixelSize, vw * pixelSize, vh * pixelSize);
  }
}
