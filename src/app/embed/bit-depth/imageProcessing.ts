export type ChannelMode = "rgb" | "luminance" | "red" | "green" | "blue";

function quantizeValue(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Quantizes a flat array of 0-255 values to `bits` bits (2**bits evenly
 * spaced levels spanning the full 0-255 range), optionally via Floyd-
 * Steinberg error diffusion instead of plain per-pixel rounding - the
 * standard algorithm for "dithering": the rounding error at each pixel is
 * carried forward into its right/bottom neighbors (7/16, 3/16, 5/16, 1/16),
 * so areas that would otherwise band into solid blocks instead scatter into
 * a dot pattern whose local density approximates the lost in-between tones. */
function quantizeChannel(values: Float64Array, width: number, height: number, bits: number, dither: boolean): Float64Array {
  const maxIndex = 2 ** bits - 1;
  const step = 255 / maxIndex;
  const output = new Float64Array(values.length);

  if (!dither) {
    for (let i = 0; i < values.length; i++) {
      output[i] = quantizeValue(values[i], step);
    }
    return output;
  }

  const buffer = Float64Array.from(values);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const original = buffer[i];
      const quantized = quantizeValue(original, step);
      output[i] = quantized;

      const error = original - quantized;
      if (x + 1 < width) buffer[i + 1] += error * (7 / 16);
      if (x - 1 >= 0 && y + 1 < height) buffer[i + width - 1] += error * (3 / 16);
      if (y + 1 < height) buffer[i + width] += error * (5 / 16);
      if (x + 1 < width && y + 1 < height) buffer[i + width + 1] += error * (1 / 16);
    }
  }
  return output;
}

/** Rec. 601 luma weights - the classic grayscale conversion formula. */
function computeLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Produces the processed image for the current (bits, dither, mode)
 * combination: "rgb" quantizes each of R/G/B independently then recombines,
 * while the single-channel modes reduce to one scalar per pixel first
 * (luminance, or a raw channel) and quantize that, displayed as grayscale. */
export function processImageData(source: ImageData, bits: number, dither: boolean, mode: ChannelMode): ImageData {
  const { width, height, data } = source;
  const pixelCount = width * height;
  const output = new ImageData(width, height);

  if (mode === "rgb") {
    const r = new Float64Array(pixelCount);
    const g = new Float64Array(pixelCount);
    const b = new Float64Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      r[i] = data[i * 4];
      g[i] = data[i * 4 + 1];
      b[i] = data[i * 4 + 2];
    }
    const qr = quantizeChannel(r, width, height, bits, dither);
    const qg = quantizeChannel(g, width, height, bits, dither);
    const qb = quantizeChannel(b, width, height, bits, dither);
    for (let i = 0; i < pixelCount; i++) {
      output.data[i * 4] = qr[i];
      output.data[i * 4 + 1] = qg[i];
      output.data[i * 4 + 2] = qb[i];
      output.data[i * 4 + 3] = 255;
    }
    return output;
  }

  const scalar = new Float64Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    scalar[i] = mode === "luminance" ? computeLuminance(r, g, b) : mode === "red" ? r : mode === "green" ? g : b;
  }
  const quantized = quantizeChannel(scalar, width, height, bits, dither);
  for (let i = 0; i < pixelCount; i++) {
    const v = quantized[i];
    output.data[i * 4] = v;
    output.data[i * 4 + 1] = v;
    output.data[i * 4 + 2] = v;
    output.data[i * 4 + 3] = 255;
  }
  return output;
}
