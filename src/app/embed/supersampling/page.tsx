"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { FullscreenIcon, useFullscreen } from "@/components/demo-ui/fullscreen";
import { drawScene, drawThumbnail, paintFramebuffer, type SceneState, type ThemeColors, type ViewTransform } from "@/scenes/supersampling/draw";
import { inside, rasterize, RESOLUTION, SAMPLE_COUNTS, type SampleCount, type ShapeId } from "@/scenes/supersampling/raster";

/** Controls are laid out for the default 760 x 428 embed and scaled up with
 * CSS zoom on bigger screens and in fullscreen. The canvas takes the rest. */
const BASE_WIDTH = 760;
const BASE_HEIGHT = 428;
const uiZoomFor = (width: number, height: number) => Math.min(2.4, Math.max(1, Math.min(width / BASE_WIDTH, height / BASE_HEIGHT)));

const MIN_ZOOM = 1;
const MAX_ZOOM = 32;
const ZOOM_STEP = 1.5;
const WHEEL_ZOOM_FACTOR = 1.15;
/** Share of the canvas's short side the framebuffer fills at zoom 1. */
const FIT = 0.94;
const DEFAULT_ANGLE = (12 * Math.PI) / 180;
const TAU = Math.PI * 2;

const SHAPES: { id: ShapeId; label: string; icon: keyof typeof ICONS }[] = [
  { id: "circle", label: "Circle", icon: "circle" },
  { id: "triangle", label: "Triangle", icon: "triangle" },
  { id: "square", label: "Square", icon: "square" },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const wrapAngle = (angle: number) => ((angle % TAU) + TAU) % TAU;

const ROTATE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="white" stroke-width="4"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 3v4h-4"/></g><g stroke="black" stroke-width="2"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 3v4h-4"/></g></svg>'
)}") 12 12, grab`;

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent";

function Button({
  children,
  onClick,
  active = false,
  title,
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`flex h-7 items-center justify-center gap-1 rounded-md border px-2 text-xs font-medium whitespace-nowrap transition-colors ${FOCUS} ${
        active ? "border-accent bg-accent text-accent-foreground" : "border-border bg-bg text-text hover:border-accent"
      } ${className}`}
    >
      {children}
    </button>
  );
}

const ICONS = {
  circle: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z",
  triangle: "M12 4l8.5 15h-17z",
  square: "M5 5h14v14H5z",
  rotate: "M20 12a8 8 0 1 1-2.3-5.7M20 3v4h-4",
  raster: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  samples: "M4 4h16v16H4zM12 4v16M4 12h16",
  grid: "M4 4h16v16H4zM9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16",
  zoomIn: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5L20 20M8 10.5h5M10.5 8v5",
  zoomOut: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5L20 20M8 10.5h5",
  reset: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5",
};

function Icon({ name, className = "h-3.5 w-3.5" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

function Group({ children, label, dim = false }: { children: ReactNode; label: string; dim?: boolean }) {
  return (
    <div role="group" aria-label={label} className={`flex items-center gap-0.5 rounded-md border border-border bg-bg p-0.5 transition-opacity ${dim ? "opacity-50" : ""}`}>
      {children}
    </div>
  );
}

function Segment({ children, active, onClick, title }: { children: ReactNode; active: boolean; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-xs font-medium whitespace-nowrap transition-colors ${FOCUS} ${
        active ? "bg-accent text-accent-foreground" : "text-text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function readTheme(): ThemeColors {
  const css = getComputedStyle(document.documentElement);
  const color = (name: string) => `rgb(${css.getPropertyValue(name).trim().split(/\s+/).join(", ")})`;
  return {
    bg: color("--color-bg"),
    elevated: color("--color-bg-elevated"),
    text: color("--color-text"),
    muted: color("--color-text-muted"),
    accent: color("--color-accent"),
    border: color("--color-border"),
  };
}

/** The light/dark theme is a class on <html>. */
const subscribeThemeClass = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface View {
  zoom: number;
  /** Framebuffer point at the centre of the canvas. */
  cx: number;
  cy: number;
}

const HOME_VIEW: View = { zoom: 1, cx: RESOLUTION / 2, cy: RESOLUTION / 2 };

type Drag =
  | { kind: "rotate"; startPointer: number; startAngle: number }
  | { kind: "pan"; x: number; y: number }
  | { kind: "pinch"; distance: number; zoom: number; fbX: number; fbY: number };

/** Standalone, chrome-free page meant to be embedded (e.g. as an iframe in a
 * Canvas LMS page). A shape is rasterized into a 64 x 64 framebuffer on the
 * CPU with 1, 4, 16 or 64 samples per pixel; zoom in to see the pixels and
 * the samples inside them. */
export default function SupersamplingEmbedPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framebufferRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<View>(HOME_VIEW);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragRef = useRef<Drag | null>(null);
  const drawRef = useRef<() => void>(() => {});

  const [shape, setShape] = useState<ShapeId>("triangle");
  const [angle, setAngle] = useState(DEFAULT_ANGLE);
  const [rasterized, setRasterized] = useState(false);
  const [samples, setSamples] = useState<SampleCount>(1);
  const [grid, setGrid] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const themeClass = useSyncExternalStore(subscribeThemeClass, () => document.documentElement.className, () => null);
  const theme = useMemo(() => (themeClass === null ? null : readTheme()), [themeClass]);
  const [rootSize, setRootSize] = useState({ w: 0, h: 0 });
  const fullscreen = useFullscreen(rootRef);

  const uiZoom = rootSize.w ? uiZoomFor(rootSize.w, rootSize.h) : 1;
  const coverage = useMemo(() => rasterize(shape, angle, samples), [shape, angle, samples]);

  const viewTransform = useCallback((width: number, height: number): ViewTransform => {
    const { zoom, cx, cy } = viewRef.current;
    const scale = ((Math.min(width, height) * FIT) / RESOLUTION) * zoom;
    return { scale, ox: width / 2 - cx * scale, oy: height / 2 - cy * scale };
  }, []);

  const requestDraw = useCallback(() => drawRef.current(), []);

  /** Sets zoom while keeping the framebuffer point under (sx, sy) in place. */
  const zoomAt = useCallback(
    (zoom: number, sx: number, sy: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const width = canvas.clientWidth, height = canvas.clientHeight;
      const before = viewTransform(width, height);
      const fbX = (sx - before.ox) / before.scale, fbY = (sy - before.oy) / before.scale;
      const next = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
      const scale = (before.scale / viewRef.current.zoom) * next;
      viewRef.current =
        next <= MIN_ZOOM
          ? HOME_VIEW
          : {
              zoom: next,
              cx: clamp(fbX - (sx - width / 2) / scale, 0, RESOLUTION),
              cy: clamp(fbY - (sy - height / 2) / scale, 0, RESOLUTION),
            };
      setZoomed(next > MIN_ZOOM);
      requestDraw();
    },
    [viewTransform, requestDraw]
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const canvas = canvasRef.current;
      if (canvas) zoomAt(viewRef.current.zoom * factor, canvas.clientWidth / 2, canvas.clientHeight / 2);
    },
    [zoomAt]
  );

  const resetView = useCallback(() => {
    viewRef.current = HOME_VIEW;
    setZoomed(false);
    requestDraw();
  }, [requestDraw]);

  // Root size for the UI zoom.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setRootSize({ w: width, h: height });
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  // The resolved 64 x 64 image.
  useEffect(() => {
    if (!theme) return;
    if (!framebufferRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = RESOLUTION;
      framebufferRef.current = canvas;
    }
    paintFramebuffer(framebufferRef.current, coverage, theme);
  }, [coverage, theme]);

  // Drawing. Batched to one frame; redrawn on resize and whenever the state changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const framebuffer = framebufferRef.current;
    if (!canvas || !framebuffer || !theme) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const state: SceneState = { shape, angle, rasterize: rasterized, samples, grid };

    let frame = 0;
    const draw = () => {
      frame = 0;
      const width = canvas.clientWidth, height = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(width * dpr)), h = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const view = viewTransform(width, height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScene(ctx, width, height, state, view, framebuffer, theme);

      // The same image at (almost) its real size, with the zoomed region marked.
      if (state.rasterize) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const pixelSize = Math.max(1, Math.round(dpr * uiZoom));
        const margin = Math.round(8 * dpr * uiZoom);
        const visible = viewRef.current.zoom > MIN_ZOOM ? { x: -view.ox / view.scale, y: -view.oy / view.scale, w: width / view.scale, h: height / view.scale } : null;
        drawThumbnail(ctx, framebuffer, margin, margin, pixelSize, visible, theme, dpr);
      }
    };
    drawRef.current = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    draw();

    const observer = new ResizeObserver(() => drawRef.current());
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      drawRef.current = () => {};
    };
  }, [shape, angle, rasterized, samples, grid, coverage, theme, uiZoom, viewTransform]);

  // Wheel zoom (native, non-passive, so the host page doesn't scroll).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const factor = Math.pow(WHEEL_ZOOM_FACTOR, -Math.sign(event.deltaY) * Math.min(3, Math.abs(event.deltaY) / 50 || 1));
      zoomAt(viewRef.current.zoom * factor, event.clientX - rect.left, event.clientY - rect.top);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Pointer: drag the shape to rotate it, drag the empty space to pan, pinch to zoom.
  const local = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const toFramebuffer = (x: number, y: number) => {
    const canvas = canvasRef.current!;
    const view = viewTransform(canvas.clientWidth, canvas.clientHeight);
    return { view, fbX: (x - view.ox) / view.scale, fbY: (y - view.oy) / view.scale };
  };

  const pointerAngle = (x: number, y: number) => {
    const { view } = toFramebuffer(x, y);
    const c = (RESOLUTION / 2) * view.scale;
    return Math.atan2(y - (view.oy + c), x - (view.ox + c));
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = local(event);
    const pointers = pointersRef.current;
    pointers.set(event.pointerId, p);

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const mid = toFramebuffer((a.x + b.x) / 2, (a.y + b.y) / 2);
      dragRef.current = { kind: "pinch", distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: viewRef.current.zoom, fbX: mid.fbX, fbY: mid.fbY };
    } else if (pointers.size === 1) {
      const { fbX, fbY } = toFramebuffer(p.x, p.y);
      dragRef.current = inside(shape, angle, fbX, fbY) ? { kind: "rotate", startPointer: pointerAngle(p.x, p.y), startAngle: angle } : { kind: "pan", x: p.x, y: p.y };
    }
  };

  const updateCursor = (canvas: HTMLCanvasElement, x: number, y: number) => {
    const drag = dragRef.current;
    const { fbX, fbY } = toFramebuffer(x, y);
    const overShape = drag ? drag.kind === "rotate" : inside(shape, angle, fbX, fbY);
    canvas.style.cursor = overShape ? ROTATE_CURSOR : zoomed ? (drag ? "grabbing" : "grab") : "default";
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const p = local(event);
    const pointers = pointersRef.current;
    const drag = dragRef.current;
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, p);

    if (drag?.kind === "rotate") {
      setAngle(wrapAngle(drag.startAngle + pointerAngle(p.x, p.y) - drag.startPointer));
    } else if (drag?.kind === "pan" && viewRef.current.zoom > MIN_ZOOM) {
      const { view } = toFramebuffer(p.x, p.y);
      const v = viewRef.current;
      viewRef.current = { ...v, cx: clamp(v.cx - (p.x - drag.x) / view.scale, 0, RESOLUTION), cy: clamp(v.cy - (p.y - drag.y) / view.scale, 0, RESOLUTION) };
      dragRef.current = { kind: "pan", x: p.x, y: p.y };
      requestDraw();
    } else if (drag?.kind === "pinch" && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const canvas = event.currentTarget;
      const width = canvas.clientWidth, height = canvas.clientHeight;
      const zoom = clamp((drag.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, drag.distance), MIN_ZOOM, MAX_ZOOM);
      const scale = ((Math.min(width, height) * FIT) / RESOLUTION) * zoom;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      // Keep the framebuffer point that started under the fingers' midpoint under it.
      viewRef.current =
        zoom <= MIN_ZOOM
          ? HOME_VIEW
          : { zoom, cx: clamp(drag.fbX - (mx - width / 2) / scale, 0, RESOLUTION), cy: clamp(drag.fbY - (my - height / 2) / scale, 0, RESOLUTION) };
      setZoomed(zoom > MIN_ZOOM);
      requestDraw();
    }
    updateCursor(event.currentTarget, p.x, p.y);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const pointers = pointersRef.current;
    pointers.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    // Lifting one finger of a pinch carries on as a pan with the other.
    const rest = [...pointers.values()][0];
    dragRef.current = rest ? { kind: "pan", x: rest.x, y: rest.y } : null;
    const p = local(event);
    updateCursor(event.currentTarget, p.x, p.y);
  };

  // Keyboard shortcuts, unless a form control has focus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, select, textarea") || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      const step = ((event.shiftKey ? 15 : 1) * Math.PI) / 180;
      if (event.key === "ArrowLeft") setAngle((a) => wrapAngle(a - step));
      else if (event.key === "ArrowRight") setAngle((a) => wrapAngle(a + step));
      else if (key === "r") setRasterized((r) => !r);
      else if (key === "g") setGrid((g) => !g);
      else if (key === "f" && fullscreen.enabled) fullscreen.toggle();
      else if (event.key === "+" || event.key === "=") zoomBy(ZOOM_STEP);
      else if (event.key === "-") zoomBy(1 / ZOOM_STEP);
      else if (event.key === "0") resetView();
      else if (event.key >= "1" && event.key <= "4") {
        setSamples(SAMPLE_COUNTS[Number(event.key) - 1]);
        setRasterized(true);
      } else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, zoomBy, resetView]);

  const degrees = Math.round((angle * 180) / Math.PI) % 360;

  return (
    <div ref={rootRef} className="flex h-screen w-screen flex-col gap-1.5 overflow-hidden bg-bg p-1.5 text-text">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-border">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={resetView}
        />
        {fullscreen.enabled && (
          <button
            type="button"
            onClick={fullscreen.toggle}
            title={fullscreen.active ? "Exit full screen (F)" : "Full screen (F)"}
            aria-label={fullscreen.active ? "Exit full screen" : "Full screen"}
            className={`absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-md border border-border bg-bg/90 text-text transition-colors hover:border-accent ${FOCUS}`}
            style={{ zoom: uiZoom }}
          >
            <FullscreenIcon exit={fullscreen.active} className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5" style={{ zoom: uiZoom }}>
        <Group label="Shape">
          {SHAPES.map((s) => (
            <Segment key={s.id} active={shape === s.id} onClick={() => setShape(s.id)} title={s.label}>
              <Icon name={s.icon} />
            </Segment>
          ))}
        </Group>

        <label className="flex h-7 items-center gap-1 rounded-md border border-border bg-bg px-2 text-xs text-text" title="Rotate (← →, or drag the shape)">
          <Icon name="rotate" />
          <span className="sr-only">Rotation</span>
          <input
            type="range"
            min={0}
            max={359}
            step={1}
            value={degrees}
            onChange={(event) => setAngle((Number(event.target.value) * Math.PI) / 180)}
            className={`h-4 w-20 cursor-pointer accent-[rgb(var(--color-accent))] ${FOCUS}`}
          />
          <span className="w-7 text-right font-mono text-[11px] text-text-muted">{degrees}°</span>
        </label>

        <Button onClick={() => setRasterized((r) => !r)} active={rasterized} title="Rasterize (R)">
          <Icon name="raster" />
          Rasterize
        </Button>

        <Group label="Anti-aliasing" dim={!rasterized}>
          <span className="flex items-center gap-1 px-1 text-xs text-text-muted" title="Supersampling: samples per pixel">
            <Icon name="samples" />
            AA
          </span>
          {SAMPLE_COUNTS.map((count, i) => (
            <Segment
              key={count}
              active={samples === count}
              onClick={() => {
                setSamples(count);
                setRasterized(true);
              }}
              title={count === 1 ? `Anti-aliasing off (${i + 1})` : `${count} samples per pixel (${i + 1})`}
            >
              {count === 1 ? "Off" : `${count}×`}
            </Segment>
          ))}
        </Group>

        <Button onClick={() => setGrid((g) => !g)} active={grid} title="Show grid (G)">
          <Icon name="grid" />
          Grid
        </Button>

        <div className="ml-auto flex items-center gap-1">
          <Button onClick={() => zoomBy(1 / ZOOM_STEP)} title="Zoom out (−)" className="w-7 px-0">
            <Icon name="zoomOut" />
          </Button>
          <Button onClick={() => zoomBy(ZOOM_STEP)} title="Zoom in (+)" className="w-7 px-0">
            <Icon name="zoomIn" />
          </Button>
          <Button onClick={resetView} title="Reset view (0)" className={`w-7 px-0 transition-opacity ${zoomed ? "" : "opacity-50"}`}>
            <Icon name="reset" />
          </Button>
        </div>
      </div>
    </div>
  );
}
