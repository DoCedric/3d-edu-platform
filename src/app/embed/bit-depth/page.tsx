"use client";

import { useEffect, useRef, useState } from "react";
import wazowski from "@/imgs/wazowski.png";
import { processImageData, type ChannelMode } from "./imageProcessing";

const CHANNEL_OPTIONS: { id: ChannelMode; label: string }[] = [
  { id: "rgb", label: "RGB" },
  { id: "luminance", label: "Luminance" },
  { id: "red", label: "Red" },
  { id: "green", label: "Green" },
  { id: "blue", label: "Blue" },
];

const MIN_ZOOM = 1;
const MAX_ZOOM = 16;
const WHEEL_ZOOM_FACTOR = 1.15;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function centeredOffset(containerWidth: number, containerHeight: number, scale: number) {
  return { x: (containerWidth - wazowski.width * scale) / 2, y: (containerHeight - wazowski.height * scale) / 2 };
}

/** Standalone, chrome-free page meant to be embedded (e.g. as an iframe in a
 * Superhuman doc) rather than navigated to inside the lesson shell. No 3D
 * here - a plain 2D canvas, reprocessed with the 2D canvas API whenever a
 * control changes. */
export default function BitDepthEmbedPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceDataRef = useRef<ImageData | null>(null);

  const [imageReady, setImageReady] = useState(false);
  const [bitDepth, setBitDepth] = useState(8);
  const [dither, setDither] = useState(false);
  const [channelMode, setChannelMode] = useState<ChannelMode>("rgb");

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  // Mirrors of the latest render's values, read by the native (non-passive)
  // wheel listener below so it never closes over stale state without having
  // to re-subscribe the listener on every zoom/pan tick.
  const zoomRef = useRef(zoom);
  const offsetRef = useRef(offset);
  const fitScaleRef = useRef(1);
  useEffect(() => {
    zoomRef.current = zoom;
    offsetRef.current = offset;
  }, [zoom, offset]);

  useEffect(() => {
    const image = new Image();
    image.src = wazowski.src;
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(image, 0, 0);
      sourceDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setImageReady(true);
    };
  }, []);

  useEffect(() => {
    if (!imageReady) return;
    const canvas = canvasRef.current;
    const source = sourceDataRef.current;
    if (!canvas || !source) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(processImageData(source, bitDepth, dither, channelMode), 0, 0);
  }, [imageReady, bitDepth, dither, channelMode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fitScale = containerSize.width && containerSize.height ? Math.min(containerSize.width / wazowski.width, containerSize.height / wazowski.height) : 1;
  const baseWidth = wazowski.width * fitScale;
  const baseHeight = wazowski.height * fitScale;
  useEffect(() => {
    fitScaleRef.current = fitScale;
  }, [fitScale]);

  // Re-center whenever the container's size changes (covers first load and
  // the host page resizing this embedded iframe). Adjusted directly during
  // render - React's documented pattern for "reset state when an input
  // changes" - rather than in an effect, which would commit a stale frame
  // first and only fix it up a tick later.
  const [lastContainerSize, setLastContainerSize] = useState(containerSize);
  if (containerSize.width !== lastContainerSize.width || containerSize.height !== lastContainerSize.height) {
    setLastContainerSize(containerSize);
    if (containerSize.width && containerSize.height) {
      setZoom(1);
      setOffset(centeredOffset(containerSize.width, containerSize.height, fitScale));
    }
  }

  // Native (non-passive) wheel listener: React's synthetic onWheel is
  // passive by default, so event.preventDefault() inside it silently fails
  // to stop the page from scrolling underneath the zoom gesture.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;

      const prevZoom = zoomRef.current;
      const prevOffset = offsetRef.current;
      const nextZoom = clamp(prevZoom * (event.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR), MIN_ZOOM, MAX_ZOOM);

      const prevScale = fitScaleRef.current * prevZoom;
      const nextScale = fitScaleRef.current * nextZoom;

      setZoom(nextZoom);
      if (nextZoom <= MIN_ZOOM) {
        // Back at 100%: snap to centered rather than wherever the cursor
        // happened to be, so zooming all the way back out never leaves the
        // image sitting off to one side.
        setOffset(centeredOffset(rect.width, rect.height, fitScaleRef.current));
      } else {
        // Keep the image point under the cursor fixed on screen as zoom changes.
        const imageX = (cursorX - prevOffset.x) / prevScale;
        const imageY = (cursorY - prevOffset.y) / prevScale;
        setOffset({ x: cursorX - imageX * nextScale, y: cursorY - imageY * nextScale });
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= MIN_ZOOM) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    setOffset((prev) => ({ x: prev.x + event.movementX, y: prev.y + event.movementY }));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsPanning(false);
  };

  const applyZoom = (nextZoom: number) => {
    const container = containerRef.current;
    if (!container) return;
    const clamped = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    setZoom(clamped);

    if (clamped <= MIN_ZOOM) {
      setOffset(centeredOffset(container.clientWidth, container.clientHeight, fitScale));
      return;
    }
    const centerX = container.clientWidth / 2;
    const centerY = container.clientHeight / 2;
    const prevScale = fitScale * zoom;
    const nextScale = fitScale * clamped;
    const imageX = (centerX - offset.x) / prevScale;
    const imageY = (centerY - offset.y) / prevScale;
    setOffset({ x: centerX - imageX * nextScale, y: centerY - imageY * nextScale });
  };

  const resetView = () => {
    setZoom(1);
    setOffset(centeredOffset(containerSize.width, containerSize.height, fitScale));
  };

  const levelCount = 2 ** bitDepth;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bg">
      <div
        ref={containerRef}
        className="absolute inset-0 touch-none overflow-hidden"
        style={{ cursor: zoom > MIN_ZOOM ? (isPanning ? "grabbing" : "grab") : "default" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <canvas
          ref={canvasRef}
          className="absolute"
          style={{
            left: offset.x,
            top: offset.y,
            width: baseWidth * zoom,
            height: baseHeight * zoom,
            imageRendering: "pixelated",
          }}
        />
      </div>

      <div className="absolute top-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-md border border-border bg-bg-elevated/90 p-1 shadow-lg backdrop-blur">
        {CHANNEL_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() => setChannelMode(option.id)}
            className={`rounded px-3 py-1.5 text-sm transition-colors ${
              channelMode === option.id ? "bg-accent text-accent-foreground" : "text-text-muted hover:text-text"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="absolute bottom-3 left-3 w-[280px] rounded-md border border-border bg-bg-elevated/90 px-4 py-3 text-text shadow-lg backdrop-blur">
        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-text-muted">
          <span>Bit depth</span>
          <span className="font-mono text-text">
            {bitDepth}-bit · {levelCount} levels
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={8}
          step={1}
          value={bitDepth}
          onChange={(event) => setBitDepth(Number(event.target.value))}
          className="w-full"
        />

        <label className="mt-3 flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={dither} onChange={() => setDither((prev) => !prev)} className="h-4 w-4" />
          <span>Dithering</span>
        </label>

        <div className="mt-2 text-xs leading-snug text-text-muted">
          Lower the bit depth to see banding appear; dithering scatters the lost tones into a dot pattern instead.
        </div>
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md border border-border bg-bg-elevated/90 p-1 text-text shadow-lg backdrop-blur">
        <button onClick={() => applyZoom(zoom / WHEEL_ZOOM_FACTOR)} className="rounded px-2.5 py-1 text-sm hover:bg-bg" aria-label="Zoom out">
          −
        </button>
        <span className="min-w-[3.5rem] text-center font-mono text-xs text-text-muted">{Math.round(zoom * 100)}%</span>
        <button onClick={() => applyZoom(zoom * WHEEL_ZOOM_FACTOR)} className="rounded px-2.5 py-1 text-sm hover:bg-bg" aria-label="Zoom in">
          +
        </button>
        <button onClick={resetView} className="ml-1 rounded px-2 py-1 text-xs text-text-muted hover:bg-bg hover:text-text">
          Reset
        </button>
      </div>
    </div>
  );
}
