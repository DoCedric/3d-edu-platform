"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { FullscreenIcon, useFullscreen } from "@/components/demo-ui/fullscreen";
import {
  DEFAULT_TOGGLES,
  MAX_RESOLUTION,
  MIN_RESOLUTION,
  RasterPipelineEngine,
  SPACES,
  STEP_COUNT,
  type Space,
  type Toggles,
} from "@/scenes/raster-pipeline/engine";
import { loadModel, MODELS, type ModelId } from "@/scenes/raster-pipeline/model";
import { shadeFragment } from "@/scenes/raster-pipeline/pipeline";
import { drawScreen, HEAT_LEGEND, type GridRect } from "@/scenes/raster-pipeline/screenView";
import { CAMERA_COLOR, DRAG_THRESHOLD, FinalFrameView, WorldView, type ThemeColors } from "@/scenes/raster-pipeline/worldView";

/** Chrome (bar, controls, explanation) is laid out for the default 760 x 428 embed
 * and scaled up with CSS zoom on bigger screens and in fullscreen, so the
 * text stays readable on a projector. The two views take all the rest. */
const BASE_WIDTH = 760;
const BASE_HEIGHT = 428;
const uiZoomFor = (width: number, height: number) => Math.min(2.4, Math.max(1, Math.min(width / BASE_WIDTH, height / BASE_HEIGHT)));

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

interface Step {
  name: string;
  /** Two-line label for the pipeline bar. */
  short: [string, string?];
  text: ReactNode;
}

const STEPS: Step[] = [
  {
    name: "The mesh",
    short: ["Mesh"],
    text: (
      <>
        A <b>mesh</b> is just a list of points (<b>vertices</b>) and the triangles that connect them. That&apos;s all the GPU gets: no surface, no colour yet.
      </>
    ),
  },
  {
    name: "Vertex shader",
    short: ["Vertex", "shader"],
    text: (
      <>
        The <b>vertex shader</b> runs once for every vertex. It moves each point from the model, through the world and the camera&apos;s view, onto the screen.
        That&apos;s the projection from earlier lessons.
      </>
    ),
  },
  {
    name: "Culling",
    short: ["Culling"],
    text: (
      <>
        <b>Culling</b> throws away triangles the camera can&apos;t see: ones facing away (red stripes) and ones completely outside the frustum (grey). The
        cheapest triangle is one you never draw. Triangles that cross the near plane are <i>clipped</i> (cut) instead.
      </>
    ),
  },
  {
    name: "Rasterization",
    short: ["Raster"],
    text: (
      <>
        <b>Rasterization</b> answers one question: which pixels does this triangle cover? Each pixel centre is tested, and every covered pixel becomes a{" "}
        <b>fragment</b>.
      </>
    ),
  },
  {
    name: "Fragment shader",
    short: ["Fragment", "shader"],
    text: (
      <>
        The <b>fragment shader</b> runs once for every fragment and calculates its colour from the material (the BSDF) and the lights. This is where shader
        graphs run. Flat uses one normal per triangle; Smooth blends the normals per pixel, like Phong shading (Gouraud blended colours instead).
      </>
    ),
  },
  {
    name: "Depth test & output",
    short: ["Depth", "test"],
    text: (
      <>
        Several fragments can land on the same pixel. The <b>depth test</b> (the z-buffer, Ed Catmull, 1974) keeps only the one closest to the camera. Real
        GPUs often test depth <i>before</i> the fragment shader (early-Z) to save work.
      </>
    ),
  },
  {
    name: "Final frame",
    short: ["Final", "frame"],
    text: (
      <>
        That was <b>one frame</b>. A game does all of this 60 times per second, in 16.6 ms per frame. See the jagged edges? That&apos;s <b>aliasing</b>, which
        comes back in &ldquo;Faking the samples&rdquo;.
      </>
    ),
  },
];

const SPACE_NAMES: Record<Space, string> = { model: "Model", world: "World", view: "View", screen: "Screen" };

const fmt = (n: number) => n.toLocaleString("en-US");
const fixed = (n: number) => (Math.abs(n) < 0.005 ? "0.00" : n.toFixed(2));

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent";

function Button({
  children,
  onClick,
  active = false,
  disabled = false,
  title,
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active || undefined}
      className={`flex items-center justify-center gap-1 rounded-md border text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-35 ${FOCUS} ${
        active ? "border-accent bg-accent text-accent-foreground" : "border-border bg-bg text-text enabled:hover:border-accent"
      } ${className}`}
    >
      {children}
    </button>
  );
}

const ICONS = {
  cull: "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-3 4M6.6 6.6C4.3 8 2.7 10.2 2 12c1 2.5 5 7 10 7 1.8 0 3.4-.6 4.8-1.4",
  shift: "M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4",
  step: "M5 5l9 7-9 7zM17 5v14",
  all: "M3 5l8 7-8 7zM12 5l8 7-8 7z",
  heat: "M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z",
  smooth: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18",
  normals: "M12 21V5M7 10l5-5 5 5M4 21h16",
  color: "M12 3a9 9 0 1 0 0 18c1 0 2-1 2-2s-1-2 0-3 2 0 4 0a3 3 0 0 0 3-3c0-5-4-10-9-10zM7.5 11.5h0M10 7.5h0M15 7.5h0",
  depth: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
  test: "M4 4h16v16H4zM8 12l3 3 5-6",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5",
  reset: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h0",
};

function Icon({ name, className = "h-3.5 w-3.5" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

function ToggleButton({ icon, label, active, onClick, title }: { icon: keyof typeof ICONS; label: string; active: boolean; onClick: () => void; title?: string }) {
  return (
    <Button onClick={onClick} active={active} title={title} className="h-7 px-2">
      <Icon name={icon} />
      {label}
    </Button>
  );
}

function MiniSlider({ label, icon, value, min, max, onChange }: { label: string; icon: keyof typeof ICONS; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex h-7 items-center gap-1 rounded-md border border-border bg-bg px-2 text-xs text-text" title={label}>
      <Icon name={icon} />
      <span className="sr-only">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`h-4 w-16 cursor-pointer accent-[rgb(var(--color-accent))] ${FOCUS}`}
      />
    </label>
  );
}

function Vec({ values }: { values: number[] }) {
  return <span className="font-mono">({values.map(fixed).join(", ")})</span>;
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="pointer-events-auto max-w-full rounded-md border border-border bg-bg/90 p-2 text-[10px] leading-snug text-text shadow-lg backdrop-blur-sm">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold">{title}</span>
        <button type="button" onClick={onClose} className={`rounded px-1 text-text-muted hover:text-text ${FOCUS}`} aria-label="Close">
          ×
        </button>
      </div>
      {children}
    </div>
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

/** Largest 4:3 rectangle centred in a box. */
function fitGrid(width: number, height: number): GridRect {
  const w = Math.floor(Math.min(width, (height * 4) / 3));
  const h = Math.floor((w * 3) / 4);
  return { x: Math.floor((width - w) / 2), y: Math.floor((height - h) / 2), w, h };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** Standalone, chrome-free page meant to be embedded (e.g. as an iframe in a
 * Canvas LMS page). The world view is three.js; the screen view is a
 * software rasterizer in src/scenes/raster-pipeline/pipeline.ts. */
export default function RasterPipelineEmbedPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const worldCanvasRef = useRef<HTMLCanvasElement>(null);
  const screenBoxRef = useRef<HTMLDivElement>(null);
  const screenCanvasRef = useRef<HTMLCanvasElement>(null);
  const gpuCanvasRef = useRef<HTMLCanvasElement>(null);
  const worldViewRef = useRef<WorldView | null>(null);
  const screenDragRef = useRef<{ id: number; x: number; y: number; startX: number; startY: number; dragging: boolean } | null>(null);
  const dividerDragRef = useRef(false);

  const [engine, setEngine] = useState<RasterPipelineEngine | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rootSize, setRootSize] = useState({ w: 0, h: 0 });
  const [grid, setGrid] = useState<GridRect>({ x: 0, y: 0, w: 0, h: 0 });
  const [, setTick] = useState(0);
  const [explainOpen, setExplainOpen] = useState(false);
  const [modelId, setModelId] = useState<ModelId>("suzanne");
  const [hintVisible, setHintVisible] = useState(true);
  const fullscreen = useFullscreen(rootRef);

  const uiZoom = rootSize.w ? uiZoomFor(rootSize.w, rootSize.h) : 1;
  const layoutW = rootSize.w / uiZoom;
  const stacked = rootSize.w > 0 && (layoutW < 560 || rootSize.w / rootSize.h < 0.95);
  const compactBar = layoutW < 600;

  // Load the selected model. A new model gets a fresh engine that keeps the
  // previous one's step, rotation, resolution and light.
  useEffect(() => {
    let cancelled = false;
    loadModel(modelId)
      .then((mesh) => {
        if (cancelled) return;
        setLoadError(null);
        setEngine((previous) => {
          const next = new RasterPipelineEngine(mesh);
          if (previous) next.adopt(previous);
          return next;
        });
      })
      .catch((error: unknown) => {
        const url = MODELS.find((m) => m.id === modelId)!.url;
        if (!cancelled) setLoadError(`Couldn't load ${url}: ${error instanceof Error ? error.message : String(error)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  // Track the root size (for zoom/layout) and the screen view's 4:3 grid.
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

  useEffect(() => {
    const box = screenBoxRef.current;
    if (!box || !engine) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setGrid(fitGrid(width, height));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [engine]);

  const goToStep = useCallback(
    (step: number) => {
      if (!engine) return;
      engine.setStep(step);
      setTick((t) => t + 1);
    },
    [engine]
  );

  const setToggles = useCallback(
    (patch: Partial<Toggles>) => {
      engine?.setToggles(patch);
      setTick((t) => t + 1);
    },
    [engine]
  );

  const reset = useCallback(() => {
    engine?.resetRotation();
    worldViewRef.current?.resetView();
  }, [engine]);

  // Views + animation loop.
  useEffect(() => {
    const worldCanvas = worldCanvasRef.current;
    const screenCanvas = screenCanvasRef.current;
    const gpuCanvas = gpuCanvasRef.current;
    const screenBox = screenBoxRef.current;
    if (!engine || !worldCanvas || !screenCanvas || !gpuCanvas || !screenBox) return;
    const ctx = screenCanvas.getContext("2d");
    if (!ctx) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    engine.setReducedMotion(motionQuery.matches);
    const onMotionChange = () => engine.setReducedMotion(motionQuery.matches);
    motionQuery.addEventListener("change", onMotionChange);

    const world = new WorldView(worldCanvas, engine, {
      onRotate: (axis, angle) => engine.rotate(axis, angle),
      onClick: (pick) => engine.clickWorld(pick),
      onHover: (pick) => engine.hoverWorld(pick),
      onPointerDown: () => engine.animating && engine.skipAnimation(),
    });
    worldViewRef.current = world;
    const gpu = new FinalFrameView(gpuCanvas, world.geometry);

    let theme = readTheme();
    const themeObserver = new MutationObserver(() => (theme = readTheme()));
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const worldObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      world.resize(Math.round(width), Math.round(height));
    });
    worldObserver.observe(worldCanvas);

    engine.update(performance.now());
    engine.setStep(engine.step);

    let frame = 0;
    let lastVersion = -1;
    let lastTick = 0;
    const tick = (now: number) => {
      engine.update(now);
      world.render(theme);

      // Screen view: match the backing store to the on-screen size.
      const rect = screenBox.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr));
      if (screenCanvas.width !== w || screenCanvas.height !== h) {
        screenCanvas.width = w;
        screenCanvas.height = h;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const gridRect = fitGrid(rect.width, rect.height);
      drawScreen(ctx, engine, gridRect, theme);
      if (engine.step === 6) gpu.render(engine, gridRect.w, gridRect.h, theme.bg);

      // Re-render the React UI (counts, panels) when something changed, at most ~20x a second.
      if (engine.version !== lastVersion && now - lastTick > 50) {
        lastVersion = engine.version;
        lastTick = now;
        setTick((t) => t + 1);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      motionQuery.removeEventListener("change", onMotionChange);
      themeObserver.disconnect();
      worldObserver.disconnect();
      world.dispose();
      gpu.dispose();
      worldViewRef.current = null;
    };
  }, [engine]);

  // Left/Right arrows step through the pipeline, unless an input (e.g. a slider) has focus.
  useEffect(() => {
    if (!engine) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "ArrowRight") goToStep(engine.step + 1);
      else if (event.key === "ArrowLeft") goToStep(engine.step - 1);
      else if (event.key === "Escape") {
        setExplainOpen(false);
        engine.setSelection(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [engine, goToStep]);

  // --- Screen view pointer input -------------------------------------------
  const gridPoint = (event: React.PointerEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const cell = grid.w / (engine?.resolution.width ?? 1);
    return { gx: (event.clientX - rect.left - grid.x) / cell, gy: (event.clientY - rect.top - grid.y) / cell, cell };
  };

  const onScreenPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    screenDragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, dragging: false };
  };

  const onScreenPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!engine) return;
    const drag = screenDragRef.current;
    if (!drag || drag.id !== event.pointerId) {
      if (event.pointerType === "touch") return;
      const { gx, gy } = gridPoint(event);
      engine.hoverScreen(gx, gy);
      event.currentTarget.style.cursor = "pointer";
      return;
    }
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.dragging && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) return;
    if (!drag.dragging) {
      drag.dragging = true;
      engine.setHover(null);
    }
    // Same trackball as the world view, but in the scene camera's frame.
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(engine.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(engine.camera.quaternion);
    engine.rotate(up.multiplyScalar(dx).add(right.multiplyScalar(dy)), Math.hypot(dx, dy) * 0.01);
    event.currentTarget.style.cursor = "grabbing";
  };

  const onScreenPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = screenDragRef.current;
    if (!engine || !drag || drag.id !== event.pointerId) return;
    screenDragRef.current = null;
    if (!drag.dragging && event.type === "pointerup") {
      const { gx, gy, cell } = gridPoint(event);
      engine.clickScreen(gx, gy, 10 / cell);
    }
    event.currentTarget.style.cursor = "pointer";
  };

  const onDividerPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.type === "pointerdown") {
      event.currentTarget.setPointerCapture(event.pointerId);
      dividerDragRef.current = true;
    } else if (event.type === "pointerup" || event.type === "pointercancel") {
      dividerDragRef.current = false;
      return;
    }
    if (!dividerDragRef.current) return;
    const box = screenBoxRef.current!.getBoundingClientRect();
    setToggles({ divider: Math.min(1, Math.max(0, (event.clientX - box.left - grid.x) / grid.w)) });
  };

  // --- Render ----------------------------------------------------------------
  const step = engine?.step ?? 0;
  const toggles = engine?.toggles ?? DEFAULT_TOGGLES;
  const counts = engine?.counts;
  const res = engine?.resolution ?? { width: 48, height: 36 };
  const info = STEPS[step];

  const zoomStyle = { zoom: uiZoom };

  const pipelineBar = (
    <div className="flex shrink-0 items-stretch gap-1" style={zoomStyle}>
      <Button onClick={() => goToStep(step - 1)} disabled={step === 0} title="Previous step (←)" className="w-8 shrink-0 text-base">
        ‹<span className="sr-only">Previous step</span>
      </Button>
      {compactBar ? (
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-md border border-accent bg-bg-elevated px-2 py-0.5 text-center">
          <span className="text-xs font-semibold">
            {step + 1}/{STEP_COUNT} · {info.name}
          </span>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 items-stretch gap-1">
          {STEPS.map((s, i) => (
              <button
                type="button"
                key={s.name}
                onClick={() => goToStep(i)}
                aria-current={i === step ? "step" : undefined}
                title={s.name}
                className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-md border px-0.5 py-0.5 text-[10px] leading-tight font-medium transition-colors ${FOCUS} ${
                  i === step ? "border-accent bg-accent text-accent-foreground" : i < step ? "border-border bg-bg-elevated text-text" : "border-border bg-bg text-text-muted hover:border-accent"
                }`}
              >
                <span>{s.short[0]}</span>
                {s.short[1] && <span>{s.short[1]}</span>}
              </button>
          ))}
        </div>
      )}
      <Button onClick={() => goToStep(step + 1)} disabled={step === STEP_COUNT - 1} title="Next step (→)" className="w-8 shrink-0 text-base">
        ›<span className="sr-only">Next step</span>
      </Button>
      {fullscreen.enabled && (
        <Button onClick={fullscreen.toggle} title={fullscreen.active ? "Exit full screen" : "Full screen"} className="w-8 shrink-0">
          <span className="sr-only">{fullscreen.active ? "Exit full screen" : "Full screen"}</span>
          <FullscreenIcon exit={fullscreen.active} className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  // Step-specific controls: one compact row of small toggle buttons.
  const stepControls: ReactNode = (() => {
    if (!engine) return null;
    switch (step) {
      case 1:
        return (
          <>
            <div className="flex overflow-hidden rounded-md border border-border" role="radiogroup" aria-label="Coordinate space">
              {SPACES.map((space) => (
                <button
                  key={space}
                  type="button"
                  role="radio"
                  aria-checked={toggles.space === space}
                  onClick={() => setToggles({ space })}
                  className={`h-7 px-2 text-xs font-medium ${FOCUS} ${toggles.space === space ? "bg-accent text-accent-foreground" : "bg-bg text-text hover:bg-bg-elevated"}`}
                >
                  {SPACE_NAMES[space]}
                </button>
              ))}
            </div>
          </>
        );
      case 2:
        return (
          <>
            <ToggleButton icon="cull" label="Back-face culling" active={toggles.backFaceCulling} onClick={() => setToggles({ backFaceCulling: !toggles.backFaceCulling })} />
            <ToggleButton icon="shift" label="Move camera" active={toggles.shiftCamera} onClick={() => setToggles({ shiftCamera: !toggles.shiftCamera })} title="Slide the scene camera sideways" />
          </>
        );
      case 3: {
        const total = engine.cull.visible.length;
        return (
          <>
            <Button
              onClick={() => setToggles({ rasterLimit: toggles.rasterLimit === null ? 1 : Math.min(total, toggles.rasterLimit + 1) })}
              disabled={toggles.rasterLimit !== null && toggles.rasterLimit >= total}
              className="h-7 px-2"
            >
              <Icon name="step" />
              Step triangle
            </Button>
            <Button onClick={() => setToggles({ rasterLimit: null })} disabled={toggles.rasterLimit === null} className="h-7 px-2">
              <Icon name="all" />
              Rasterize all
            </Button>
            <ToggleButton icon="heat" label="Overdraw" active={toggles.overdraw} onClick={() => setToggles({ overdraw: !toggles.overdraw })} />
          </>
        );
      }
      case 4:
        return (
          <>
            <ToggleButton icon="smooth" label={toggles.smooth ? "Smooth" : "Flat"} active={toggles.smooth} onClick={() => setToggles({ smooth: !toggles.smooth })} title="Flat / Smooth shading" />
            <ToggleButton icon="normals" label="Normals" active={toggles.showNormals} onClick={() => setToggles({ showNormals: !toggles.showNormals })} title="Show normals as RGB" />
            <MiniSlider label="Light direction (around)" icon="sun" value={engine.light.azimuth} min={-180} max={180} onChange={(azimuth) => (engine.setLight({ azimuth }), setTick((t) => t + 1))} />
            <MiniSlider label="Light height" icon="sun" value={engine.light.elevation} min={-10} max={85} onChange={(elevation) => (engine.setLight({ elevation }), setTick((t) => t + 1))} />
          </>
        );
      case 5:
        return (
          <>
            <ToggleButton
              icon={toggles.buffer === "color" ? "color" : "depth"}
              label={toggles.buffer === "color" ? "Colour buffer" : "Depth buffer"}
              active={toggles.buffer === "depth"}
              onClick={() => setToggles({ buffer: toggles.buffer === "color" ? "depth" : "color" })}
              title="Colour buffer / Depth buffer"
            />
            <ToggleButton icon="test" label="Depth test" active={toggles.depthTest} onClick={() => setToggles({ depthTest: !toggles.depthTest })} />
          </>
        );
      default:
        return null;
    }
  })();

  const counterText = (() => {
    if (!counts) return null;
    if (step === 2) return `${fmt(counts.triangles)} → ${fmt(counts.surviving)} triangles`;
    if (step === 3) {
      const limit = toggles.rasterLimit;
      if (limit === null) return `${fmt(counts.fragments)} fragments`;
      const fragments = engine!.raster.start[limit];
      return `Triangle ${fmt(limit)} of ${fmt(counts.surviving)} · ${fmt(fragments)} fragment${fragments === 1 ? "" : "s"}`;
    }
    if (step === 5 && !toggles.depthTest) return "Back faces drawn too";
    return null;
  })();

  const explainWindow = explainOpen && (
    <div
      role="dialog"
      aria-label={`Step ${step}: ${info.name}`}
      className="absolute bottom-1.5 left-1/2 z-10 w-[min(560px,calc(100%-12px))] -translate-x-1/2 rounded-md border border-border bg-bg-elevated px-3 py-2 text-xs leading-snug text-text shadow-xl"
      style={zoomStyle}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="font-semibold">
          {step}. {info.name}
        </span>
        <button type="button" onClick={() => setExplainOpen(false)} className={`ml-auto rounded px-1 text-text-muted hover:text-text ${FOCUS}`} aria-label="Close explanation">
          ×
        </button>
      </div>
      <p>{info.text}</p>
    </div>
  );

  // Info panels for the current selection.
  const panel: ReactNode = (() => {
    if (!engine || !engine.selection) return null;
    const close = () => engine.setSelection(null);
    const sel = engine.selection;
    const v = engine.vertices;
    if (sel.kind === "vertex" && step === 1) {
      const i = sel.index;
      const three = (a: Float32Array, n = 3) => Array.from(a.subarray(i * n, i * n + n));
      const rows: [Space, string, ReactNode][] = [
        ["model", "Model", <Vec key="m" values={three(engine.mesh.positions)} />],
        ["world", "World", <Vec key="w" values={three(v.world)} />],
        ["view", "View", <Vec key="v" values={three(v.view)} />],
        ["screen", "Screen", <span key="s" className="font-mono">({fixed(v.screen[i * 3])} px, {fixed(v.screen[i * 3 + 1])} px) depth {fixed(v.screen[i * 3 + 2])}</span>],
      ];
      const t = engine.transforms;
      const matrix: { label: string; m: THREE.Matrix4 | null } =
        toggles.space === "model"
          ? { label: "As stored in the file: no matrix applied yet.", m: null }
          : toggles.space === "world"
            ? { label: "× Model matrix (Suzanne's rotation):", m: t.model }
            : toggles.space === "view"
              ? { label: "× View matrix (move the world so the camera is at 0, 0, 0):", m: t.view }
              : { label: `× Projection matrix, then ÷ w and scale to ${res.width} × ${res.height} px:`, m: t.projection };
      return (
        <Panel title={`Vertex #${i}`} onClose={close}>
          <table className="border-separate border-spacing-x-1.5">
            <tbody>
              {rows.map(([space, label, value]) => (
                <tr key={space} className={toggles.space === space ? "font-semibold text-accent" : ""}>
                  <td>{label}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-1 text-text-muted">{matrix.label}</div>
          {matrix.m && (
            <div className="mt-0.5 grid w-max grid-cols-4 gap-x-2 rounded border border-border px-1 font-mono">
              {[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => <span key={`${r}${c}`} className="text-right">{fixed(matrix.m!.elements[c * 4 + r])}</span>))}
            </div>
          )}
        </Panel>
      );
    }
    if (sel.kind === "pixel" && step === 4) {
      const f = engine.winnerAt(sel.x, sel.y);
      if (f < 0) return null;
      const d = shadeFragment(engine.mesh, v, engine.raster, f, engine.transforms, { smooth: toggles.smooth, lightDirection: engine.lightDirection });
      const rgb = d.color.map((c) => Math.round(c * 255));
      return (
        <Panel title={`Fragment at pixel (${sel.x}, ${sel.y})`} onClose={close}>
          <div className="grid grid-cols-[auto_1fr] gap-x-2">
            <span className="text-[#60a5fa]">Normal N</span>
            <Vec values={d.normal.toArray()} />
            <span className="text-[#ca8a04] dark:text-[#facc15]">Light L</span>
            <Vec values={d.lightDirection.toArray()} />
            <span style={{ color: CAMERA_COLOR }}>View V</span>
            <Vec values={d.viewDirection.toArray()} />
            <span>Diffuse</span>
            <span className="font-mono">max(N·L, 0) = {fixed(d.diffuse)}</span>
            <span>Specular</span>
            <span className="font-mono">{fixed(d.specular)}</span>
            <span>Colour</span>
            <span className="flex items-center gap-1 font-mono">
              <span className="inline-block h-3 w-3 rounded-sm border border-border" style={{ background: `rgb(${rgb.join(",")})` }} />
              rgb({rgb.join(", ")})
            </span>
          </div>
        </Panel>
      );
    }
    if (sel.kind === "pixel" && step === 5) {
      const list = engine.fragmentsAt(sel.x, sel.y);
      const winner = engine.winnerAt(sel.x, sel.y);
      const shown = list.slice(0, 6);
      return (
        <Panel title={`Pixel (${sel.x}, ${sel.y}): ${list.length} fragment${list.length === 1 ? "" : "s"}`} onClose={close}>
          <table className="border-separate border-spacing-x-1.5 font-mono">
            <thead className="text-text-muted">
              <tr>
                <td>order</td>
                <td>triangle</td>
                <td>depth</td>
                <td />
              </tr>
            </thead>
            <tbody>
              {shown.map((f, k) => (
                <tr key={f} className={f === winner ? "font-semibold text-accent" : ""}>
                  <td>{k + 1}</td>
                  <td>#{engine.raster.tri[f]}</td>
                  <td>{engine.raster.z[f].toFixed(4)}</td>
                  <td>{f === winner ? "✓ kept" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length > shown.length && <div className="text-text-muted">…and {list.length - shown.length} more</div>}
          <div className="mt-1 text-text-muted">{toggles.depthTest ? "The closest (smallest depth) wins." : "No depth test: the last one written wins."}</div>
        </Panel>
      );
    }
    return null;
  })();

  const resolutionControl = (
    <label className="flex h-7 shrink-0 items-center gap-2 text-xs text-text">
      <span className="text-text-muted">Pixels</span>
      <input
        type="range"
        min={MIN_RESOLUTION}
        max={MAX_RESOLUTION}
        step={4}
        value={res.width}
        onChange={(event) => (engine?.setResolution(Number(event.target.value)), setTick((t) => t + 1))}
        className={`h-4 w-24 cursor-pointer accent-[rgb(var(--color-accent))] ${FOCUS}`}
        aria-label="Resolution"
      />
      <span className="w-[84px] whitespace-nowrap font-mono">
        {res.width} × {res.height} px
      </span>
    </label>
  );

  const explainButton = (
    <Button onClick={() => setExplainOpen((open) => !open)} active={explainOpen} title="Explain this step" className="h-7 shrink-0 px-2">
      <Icon name="info" />
      Explain
    </Button>
  );

  const resetButton = (
    <Button onClick={reset} title="Reset rotation and view" className="h-7 shrink-0 px-2">
      <Icon name="reset" />
      Reset
    </Button>
  );

  const worldView = (
    <div className={`relative min-h-0 min-w-0 overflow-hidden rounded-md border border-border bg-bg-elevated ${stacked ? "h-[42vh] min-h-[220px] shrink-0" : "flex-1"}`}>
      <canvas key={engine?.id} ref={worldCanvasRef} className="absolute inset-0 h-full w-full touch-none" />
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-1.5" style={zoomStyle}>
        <div className="flex items-start justify-between gap-2">
          <select
            value={modelId}
            onChange={(event) => setModelId(event.target.value as ModelId)}
            aria-label="Model"
            className={`pointer-events-auto cursor-pointer rounded border border-border bg-bg px-1 py-0.5 text-[11px] text-text ${FOCUS}`}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {step === 0 && counts && (
            <span className="rounded bg-bg/80 px-1.5 py-0.5 font-mono text-[11px] text-text">
              {fmt(counts.vertices)} vertices · {fmt(counts.triangles)} triangles
            </span>
          )}
        </div>
        {hintVisible && (
          <div className="pointer-events-auto flex w-max max-w-full items-center gap-1.5 self-start rounded bg-bg/80 px-1.5 py-0.5 text-[10px] text-text-muted">
            <span>Drag model: rotate · Drag background: orbit · Scroll: zoom</span>
            <button type="button" onClick={() => setHintVisible(false)} className={`rounded px-0.5 hover:text-text ${FOCUS}`} aria-label="Dismiss hint">
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const screenView = (
    <div className={`relative min-h-0 min-w-0 overflow-hidden rounded-md border border-border bg-bg-elevated ${stacked ? "aspect-[4/3.4] w-full shrink-0" : "flex-1"}`}>
      <div ref={screenBoxRef} className="absolute inset-1.5">
        <canvas
          ref={screenCanvasRef}
          onPointerDown={onScreenPointerDown}
          onPointerMove={onScreenPointerMove}
          onPointerUp={onScreenPointerUp}
          onPointerCancel={onScreenPointerUp}
          onPointerLeave={(event) => event.pointerType !== "touch" && !screenDragRef.current && engine?.setHover(null)}
          className="absolute inset-0 h-full w-full touch-none"
        />
        <canvas
          key={engine?.id}
          ref={gpuCanvasRef}
          className="pointer-events-none absolute"
          style={{
            left: grid.x,
            top: grid.y,
            width: grid.w,
            height: grid.h,
            visibility: step === 6 ? "visible" : "hidden",
            clipPath: `inset(0 0 0 ${toggles.divider * 100}%)`,
          }}
        />
        {step === 6 && (
          <>
            <div
              role="slider"
              aria-label="Comparison divider"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(toggles.divider * 100)}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.stopPropagation();
                  event.preventDefault();
                  setToggles({ divider: Math.min(1, Math.max(0, toggles.divider + (event.key === "ArrowLeft" ? -0.05 : 0.05))) });
                }
              }}
              onPointerDown={onDividerPointer}
              onPointerMove={onDividerPointer}
              onPointerUp={onDividerPointer}
              onPointerCancel={onDividerPointer}
              className={`absolute flex w-6 -translate-x-1/2 cursor-ew-resize touch-none justify-center ${FOCUS}`}
              style={{ left: grid.x + toggles.divider * grid.w, top: grid.y, height: grid.h }}
            >
              <div className="h-full w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]" />
              <div className="absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-black/40 bg-white text-[10px] text-black shadow">⇔</div>
            </div>
            <div className="pointer-events-none absolute flex justify-between p-1 text-[10px] font-semibold" style={{ left: grid.x, top: grid.y, width: grid.w, ...zoomStyle }}>
              <span className="rounded bg-black/60 px-1.5 py-0.5 text-white">
                {res.width} × {res.height}
              </span>
              <span className="rounded bg-black/60 px-1.5 py-0.5 text-white">Full resolution (GPU)</span>
            </div>
          </>
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-start gap-1 p-1.5" style={zoomStyle}>
        {counterText && <span className="rounded bg-bg/80 px-1.5 py-0.5 font-mono text-[11px] text-text">{counterText}</span>}
        {step === 3 && toggles.overdraw && (
          <span className="flex items-center gap-1.5 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] text-text">
            Fragments per pixel:
            {HEAT_LEGEND.map((h) => (
              <span key={h.label} className="flex items-center gap-0.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: h.color }} />
                {h.label}
              </span>
            ))}
          </span>
        )}
        {panel}
      </div>
    </div>
  );

  return (
    <div
      ref={rootRef}
      onPointerDownCapture={() => engine?.animating && engine.skipAnimation()}
      className={`flex h-screen w-screen flex-col gap-1.5 bg-bg p-1.5 text-text ${stacked ? "overflow-x-hidden overflow-y-auto" : "overflow-hidden"}`}
    >
      {pipelineBar}

      {!engine ? (
        <div className="flex flex-1 items-center justify-center text-sm text-text-muted">{loadError ?? "Loading Suzanne…"}</div>
      ) : (
        <>
          <div className={`relative flex min-h-0 gap-1.5 ${stacked ? "shrink-0 flex-col" : "flex-1"}`}>
            {worldView}
            {screenView}
            {explainWindow}
          </div>


          <div className="flex shrink-0 flex-wrap items-center gap-1.5" style={zoomStyle}>
            {stepControls}
            <div className="ml-auto flex items-center gap-2">
              {resolutionControl}
              {explainButton}
              {resetButton}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
