/** Width and height of the framebuffer, in pixels. */
export const RESOLUTION = 64;
const CENTER = RESOLUTION / 2;

export type ShapeId = "circle" | "triangle" | "square";

/** Samples per pixel. Each is a square number so the samples form an ordered
 * N x N grid inside the pixel, which is what the thin grid lines show. */
export const SAMPLE_COUNTS = [1, 4, 16, 64] as const;
export type SampleCount = (typeof SAMPLE_COUNTS)[number];

export const samplesPerSide = (samples: SampleCount) => Math.round(Math.sqrt(samples));

// Shapes in their own space: pixel units, centred on the origin, y down.
const CIRCLE_RADIUS = 22;
const SQUARE_HALF = 19;
const TRIANGLE_RADIUS = 25;
const TRIANGLE: [number, number][] = [-90, 30, 150].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return [TRIANGLE_RADIUS * Math.cos(a), TRIANGLE_RADIUS * Math.sin(a)];
});

function insideLocal(shape: ShapeId, x: number, y: number): boolean {
  switch (shape) {
    case "circle":
      return x * x + y * y <= CIRCLE_RADIUS * CIRCLE_RADIUS;
    case "square":
      return Math.abs(x) <= SQUARE_HALF && Math.abs(y) <= SQUARE_HALF;
    case "triangle":
      for (let i = 0; i < 3; i++) {
        const [ax, ay] = TRIANGLE[i];
        const [bx, by] = TRIANGLE[(i + 1) % 3];
        if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0) return false;
      }
      return true;
  }
}

/** Whether framebuffer point (x, y) lies inside the shape, rotated by
 * `angle` radians around the centre of the framebuffer. */
export function inside(shape: ShapeId, angle: number, x: number, y: number): boolean {
  const dx = x - CENTER, dy = y - CENTER;
  const c = Math.cos(angle), s = Math.sin(angle);
  return insideLocal(shape, c * dx + s * dy, -s * dx + c * dy);
}

/** Traces the exact (vector) outline in framebuffer coordinates. */
export function tracePath(ctx: CanvasRenderingContext2D, shape: ShapeId, angle: number) {
  ctx.beginPath();
  if (shape === "circle") {
    ctx.arc(CENTER, CENTER, CIRCLE_RADIUS, 0, Math.PI * 2);
    return;
  }
  const corners: [number, number][] =
    shape === "triangle"
      ? TRIANGLE
      : [
          [-SQUARE_HALF, -SQUARE_HALF],
          [SQUARE_HALF, -SQUARE_HALF],
          [SQUARE_HALF, SQUARE_HALF],
          [-SQUARE_HALF, SQUARE_HALF],
        ];
  const c = Math.cos(angle), s = Math.sin(angle);
  corners.forEach(([x, y], i) => {
    const px = CENTER + c * x - s * y, py = CENTER + s * x + c * y;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

/** Coverage per pixel (0..1, row-major): the fraction of the pixel's
 * samples that land inside the shape. With 1 sample this is the plain
 * aliased test at the pixel centre. */
export function rasterize(shape: ShapeId, angle: number, samples: SampleCount): Float32Array {
  const n = samplesPerSide(samples);
  const coverage = new Float32Array(RESOLUTION * RESOLUTION);
  for (let py = 0; py < RESOLUTION; py++) {
    for (let px = 0; px < RESOLUTION; px++) {
      let hits = 0;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (inside(shape, angle, px + (i + 0.5) / n, py + (j + 0.5) / n)) hits++;
      coverage[py * RESOLUTION + px] = hits / samples;
    }
  }
  return coverage;
}
