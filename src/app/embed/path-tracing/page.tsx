"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_SETTINGS, PathTracingEngine, type Draggable, type Readout, type Settings } from "@/scenes/path-tracing/engine";
import { CANVAS_HEIGHT, CANVAS_WIDTH, designToWorld, drawFrame, objectAt, pixelAt, type ThemeColors } from "@/scenes/path-tracing/draw";
import { DEFAULT_PARAMS, LAMP_MAX_RADIUS, LAMP_MIN_RADIUS, type Vec2 } from "@/scenes/path-tracing/pathTracer";

/** The controls, story bar, and caption are scaled with CSS zoom so they
 * stay a modest size on big screens (half of a 1280 x 720 "projector" layout)
 * but never shrink below readable on small ones. The canvas takes all the
 * remaining space. */
const uiZoomFor = (width: number, height: number) => Math.min(1, Math.max(0.55, 0.5 * Math.min(width / 1280, height / 720)));

const SPP_OPTIONS = [1, 4, 16, 64, 256, 1024, Infinity];
const MIDDLE_PIXEL = 23;

/** Speed slider is logarithmic: 0..100 maps to 1..10,000 paths per frame. */
const speedToSlider = (paths: number) => 25 * Math.log10(paths);
const sliderToSpeed = (value: number) => Math.max(1, Math.round(10 ** (value / 25)));

const DEFAULT_CAPTION = "Each sample: a ray leaves the camera, bounces around the room, and brings back whatever light it found.";
const LIGHT_CAPTION = "Light paths start at the lamp. Almost none of them ever reach the camera.";

// ---------------------------------------------------------------------------
// Story presets: one button each, in the order the lesson explains things.
// ---------------------------------------------------------------------------

interface StoryContext {
  update: (patch: Partial<Settings>) => void;
  engine: PathTracingEngine;
  /** Starts the step-by-step path and shows its first caption. */
  step: () => void;
}

interface StoryStep {
  caption: string;
  apply: (ctx: StoryContext) => void;
}

interface Story {
  label: string;
  steps: StoryStep[];
}

const STORIES: Story[] = [
  {
    label: "One path",
    steps: [
      {
        caption: "",
        apply: ({ update, engine, step }) => {
          update({ mode: "camera", playing: false, showPaths: true });
          engine.select(MIDDLE_PIXEL);
          engine.clearStep(); // always start a fresh path
          step();
        },
      },
    ],
  },
  {
    label: "Many paths = less noise",
    steps: [
      {
        caption: "1 sample per pixel: every pixel got just one random path. Very noisy!",
        apply: ({ update, engine }) => {
          update({ mode: "camera", maxBounces: 4, aimAtLamp: false, lampRadius: DEFAULT_PARAMS.lampRadius, sppTarget: 1, pathsPerFrame: 12, playing: true });
          engine.select(-1);
          engine.reset();
        },
      },
      {
        caption: "Now we keep adding samples, up to 256 per pixel. The noise averages out.",
        apply: ({ update }) => update({ sppTarget: 256, pathsPerFrame: 80, playing: true }),
      },
    ],
  },
  {
    label: "Bounces",
    steps: [
      {
        caption: "1 bounce: only light coming straight from the lamp. Behind the ball it is pitch black, and no colour bleeds onto the walls.",
        apply: ({ update, engine }) => {
          update({ mode: "camera", maxBounces: 1, aimAtLamp: false, lampRadius: DEFAULT_PARAMS.lampRadius, sppTarget: 256, pathsPerFrame: 400, playing: true });
          engine.select(-1);
          engine.resetLayout();
        },
      },
      {
        caption: "2 bounces: light can bounce off a wall first, so the shadow starts to fill in.",
        apply: ({ update }) => update({ maxBounces: 2, playing: true }),
      },
      {
        caption: "8 bounces: the shadow is filled in, and the grey wall picks up a red tint from the red wall (colour bleeding).",
        apply: ({ update }) => update({ maxBounces: 8, playing: true }),
      },
    ],
  },
  {
    label: "Soft vs hard shadows",
    steps: [
      {
        caption: "Big lamp: the shadow behind the ball has a soft edge, and there is little noise.",
        apply: ({ update, engine }) => {
          update({ mode: "camera", maxBounces: 4, aimAtLamp: false, lampRadius: 0.7, sppTarget: 256, pathsPerFrame: 300, playing: true });
          engine.select(-1);
          engine.resetLayout();
        },
      },
      {
        caption: "Tiny lamp, same number of samples: a hard shadow edge, and much more noise. Paths rarely find a small lamp.",
        apply: ({ update }) => update({ lampRadius: 0.04, playing: true }),
      },
    ],
  },
  {
    label: "Fireflies",
    steps: [
      {
        caption: "A tiny, very bright lamp and only 4 samples: most paths miss the lamp, the few that hit it make a pixel blazing bright. Fireflies!",
        apply: ({ update, engine }) => {
          update({ mode: "camera", maxBounces: 8, aimAtLamp: false, lampRadius: LAMP_MIN_RADIUS, sppTarget: 4, pathsPerFrame: 24, playing: true });
          engine.select(-1);
          engine.resetLayout();
        },
      },
      {
        caption: "Keep adding samples and the fireflies slowly average out - but it takes a lot of them.",
        apply: ({ update }) => update({ sppTarget: 1024, pathsPerFrame: 600, playing: true }),
      },
    ],
  },
  {
    label: "Why backwards?",
    steps: [
      {
        caption: "Paths now start at the lamp. Almost none reach the camera's tiny lens - that's why we trace from the camera instead.",
        apply: ({ update, engine }) => {
          update({ mode: "light", maxBounces: 4, lampRadius: DEFAULT_PARAMS.lampRadius, pathsPerFrame: 150, playing: true });
          engine.select(-1);
        },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="ml-2 rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-xs font-normal text-text-muted">{children}</kbd>
  );
}

function Button({ children, onClick, active = false, className = "" }: { children: ReactNode; onClick: () => void; active?: boolean; className?: string }) {
  return (
    <button
      onClick={onClick}
      // Keep focus off buttons so Space always means play/pause, never "click the last button again".
      onMouseDown={(event) => event.preventDefault()}
      className={`flex items-center justify-center rounded-md border px-3 py-2 text-base font-medium transition-colors ${
        active ? "border-accent bg-accent text-accent-foreground" : "border-border bg-bg text-text hover:border-accent"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function Slider({
  label,
  valueText,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  valueText: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between text-base">
        <span className="text-text">{label}</span>
        <span className="font-mono text-text">{valueText}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-6 w-full cursor-pointer accent-[rgb(var(--color-accent))]"
      />
    </label>
  );
}

function Toggle({ label, checked, onChange, shortcut }: { label: string; checked: boolean; onChange: (value: boolean) => void; shortcut?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-base text-text">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-[rgb(var(--color-accent))]" />
      <span>{label}</span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </label>
  );
}

const subscribeFullscreen = (onChange: () => void) => {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
};
const noopSubscribe = () => () => {};

function FullscreenIcon({ exit }: { exit: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {exit ? (
        <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
      ) : (
        <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      )}
    </svg>
  );
}

function readTheme(): ThemeColors {
  const css = getComputedStyle(document.documentElement);
  const color = (name: string) => `rgb(${css.getPropertyValue(name).trim().split(/\s+/).join(", ")})`;
  return {
    text: color("--color-text"),
    muted: color("--color-text-muted"),
    accent: color("--color-accent"),
    border: color("--color-border"),
    panel: color("--color-bg"),
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** Standalone, chrome-free page meant to be embedded (e.g. as an iframe in a
 * course page). A 2D, top-down path tracer: no Three.js here, just Canvas 2D,
 * with the tracing core kept in src/scenes/path-tracing/pathTracer.ts. */
export default function PathTracingEmbedPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasBoxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** What is being dragged, and where on it it was grabbed (world units). */
  const dragRef = useRef<{ kind: Draggable; grab: Vec2 } | null>(null);
  const [engine] = useState(() => new PathTracingEngine());

  const [uiZoom, setUiZoom] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0, left: 0 });
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [readout, setReadout] = useState<Readout>(() => engine.readout());
  const [stepCaption, setStepCaption] = useState<string | null>(null);
  const [story, setStory] = useState<{ index: number; step: number } | null>(null);
  // Fullscreen is unavailable e.g. inside an iframe without allowfullscreen; hide the button then.
  const fullscreenEnabled = useSyncExternalStore(noopSubscribe, () => document.fullscreenEnabled, () => false);
  const isFullscreen = useSyncExternalStore(subscribeFullscreen, () => !!document.fullscreenElement, () => false);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen();
  }, []);

  /** Single entry point for settings changes: the engine applies them (and
   * resets the image if needed) immediately, then React re-renders the UI. */
  const update = useCallback(
    (patch: Partial<Settings>) => {
      const next = { ...engine.settings, ...patch };
      engine.configure(next);
      setSettings(next);
      if (next.playing) setStepCaption(null);
    },
    [engine]
  );

  const step = useCallback(() => {
    const caption = engine.advanceStep(performance.now());
    setSettings({ ...engine.settings });
    setStepCaption(caption);
  }, [engine]);

  const reset = useCallback(() => {
    engine.reset();
    setStepCaption(null);
    setReadout(engine.readout());
  }, [engine]);

  const togglePlay = useCallback(() => {
    // Pressing play when the target is already reached restarts the render.
    if (!engine.settings.playing && engine.done) engine.reset();
    update({ playing: !engine.settings.playing });
  }, [engine, update]);

  const runStory = useCallback(
    (index: number, stepIndex: number) => {
      const s = STORIES[index].steps[stepIndex];
      setStepCaption(null);
      setStory({ index, step: stepIndex });
      s.apply({ update, engine, step });
    },
    [engine, update, step]
  );

  const nextStoryStep = useCallback(() => {
    if (story && story.step < STORIES[story.index].steps.length - 1) runStory(story.index, story.step + 1);
  }, [story, runStory]);

  // Size the UI chrome from the window, and fit the canvas (fixed aspect) into whatever space is left.
  useEffect(() => {
    const root = rootRef.current;
    const box = canvasBoxRef.current;
    if (!root || !box) return;
    const rootObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setUiZoom(uiZoomFor(width, height));
    });
    const boxObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const scale = Math.min(width / CANVAS_WIDTH, height / CANVAS_HEIGHT);
      const w = Math.floor(CANVAS_WIDTH * scale);
      setCanvasSize({ w, h: Math.floor(CANVAS_HEIGHT * scale), left: Math.floor((width - w) / 2) });
    });
    rootObserver.observe(root);
    boxObserver.observe(box);
    return () => {
      rootObserver.disconnect();
      boxObserver.disconnect();
    };
  }, []);

  // Animation loop: trace a time-boxed batch, then redraw.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let theme = readTheme();
    const themeObserver = new MutationObserver(() => (theme = readTheme()));
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    let frame = 0;
    let lastReadout = 0;
    const tick = (now: number) => {
      engine.update(now);

      // Match the canvas's backing store to its on-screen size for crisp lines.
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(w / CANVAS_WIDTH, 0, 0, h / CANVAS_HEIGHT, 0, 0);
      drawFrame(ctx, engine, theme, now);

      if (now - lastReadout > 120) {
        lastReadout = now;
        setReadout(engine.readout());
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      themeObserver.disconnect();
    };
  }, [engine]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === " ") {
        event.preventDefault();
        togglePlay();
      } else if (key === "s") step();
      else if (key === "r") reset();
      else if (key === "p") update({ showPaths: !engine.settings.showPaths });
      else if (key === "m") update({ mode: engine.settings.mode === "camera" ? "light" : "camera" });
      else if (key === "f" && document.fullscreenEnabled) toggleFullscreen();
      else if (key === "n" || key === "arrowright") {
        if (key === "arrowright" && event.target instanceof HTMLInputElement) return;
        nextStoryStep();
      } else if (key === "escape") engine.select(-1);
      else if (/^[1-6]$/.test(key)) runStory(Number(key) - 1, 0);
    };
    // A focused checkbox would also toggle on Space's keyup; Space is reserved for play/pause.
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === " ") event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [engine, togglePlay, step, reset, update, nextStoryStep, runStory, toggleFullscreen]);

  /** Pointer position in the canvas's 800 x 530 design space. */
  const designPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = designPoint(event);
    const kind = objectAt(engine, x, y);
    if (kind) {
      // Start dragging the ball or the lamp.
      const world = designToWorld(engine, x, y);
      const center = kind === "ball" ? engine.scene.ball.center : engine.scene.lamp.center;
      dragRef.current = { kind, grab: { x: world.x - center.x, y: world.y - center.y } };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.style.cursor = "grabbing";
      setStepCaption(null);
      return;
    }
    if (engine.settings.mode !== "camera") return;
    const pixel = pixelAt(engine, x, y);
    if (pixel >= 0) engine.toggleSelect(pixel);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = designPoint(event);
    const drag = dragRef.current;
    if (drag) {
      const world = designToWorld(engine, x, y);
      engine.moveObject(drag.kind, { x: world.x - drag.grab.x, y: world.y - drag.grab.y });
      return;
    }
    const cursor = objectAt(engine, x, y) ? "grab" : engine.settings.mode === "camera" && pixelAt(engine, x, y) >= 0 ? "pointer" : "default";
    event.currentTarget.style.cursor = cursor;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    event.currentTarget.style.cursor = "grab";
  };

  const currentStory = story ? STORIES[story.index] : null;
  const storyCaption = currentStory ? currentStory.steps[story!.step].caption : "";
  const hasNextStoryStep = !!story && story.step < STORIES[story.index].steps.length - 1;
  const caption = stepCaption ?? (storyCaption || (settings.mode === "camera" ? DEFAULT_CAPTION : LIGHT_CAPTION));
  const stepping = stepCaption !== null;
  const sppText = (n: number) => (n === Infinity ? "∞" : String(n));

  return (
    <div
      ref={rootRef}
      className="flex h-screen w-screen flex-col gap-2 overflow-hidden bg-bg p-2 text-text"
      style={{ visibility: uiZoom ? "visible" : "hidden" }}
    >
        {/* Story presets */}
        <div className="flex shrink-0 flex-wrap items-center gap-2" style={{ zoom: uiZoom || 1 }}>
          <span className="mr-1 text-base text-text-muted">Story:</span>
          {STORIES.map((s, i) => (
            <Button key={s.label} onClick={() => runStory(i, 0)} active={story?.index === i} className="py-1.5">
              <span className="mr-1.5 font-mono text-sm opacity-70">{i + 1}</span>
              {s.label}
            </Button>
          ))}
          {fullscreenEnabled && (
            <Button onClick={toggleFullscreen} className="ml-auto px-2 py-1.5">
              <span className="sr-only">{isFullscreen ? "Exit full screen" : "Full screen"}</span>
              <FullscreenIcon exit={isFullscreen} />
            </Button>
          )}
        </div>

        <div className="flex min-h-0 flex-1 gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {/* Room + image */}
            <div ref={canvasBoxRef} className="relative min-h-0 flex-1">
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="absolute top-0 touch-none rounded-md border border-border bg-bg-elevated"
                style={{ width: canvasSize.w, height: canvasSize.h, left: canvasSize.left }}
              />
            </div>

            {/* Caption */}
            <div style={{ zoom: uiZoom || 1 }}>
              <div className="flex min-h-[56px] items-center gap-3 rounded-md border border-border bg-bg-elevated px-4 py-2">
                <p className={`min-w-0 flex-1 leading-snug ${stepping ? "text-lg font-semibold" : "text-base"}`}>{caption}</p>
                {stepping && (
                  <Button onClick={step} className="shrink-0">
                    Next step <Kbd>S</Kbd>
                  </Button>
                )}
                {!stepping && hasNextStoryStep && (
                  <Button onClick={nextStoryStep} className="shrink-0" active>
                    Next ▸ <Kbd>N</Kbd>
                  </Button>
                )}
              </div>
            </div>
          </div>

        {/* Controls */}
          <div
            className="flex w-[444px] shrink-0 flex-col gap-5 overflow-y-auto rounded-md border border-border bg-bg-elevated p-5"
            style={{ zoom: uiZoom || 1 }}
          >
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => update({ mode: "camera" })} active={settings.mode === "camera"}>
              Camera paths
            </Button>
            <Button onClick={() => update({ mode: "light" })} active={settings.mode === "light"}>
              Light paths
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button onClick={togglePlay} active={settings.playing}>
              {settings.playing ? "Pause" : "Play"}
              <Kbd>Space</Kbd>
            </Button>
            <Button onClick={step}>
              Step <Kbd>S</Kbd>
            </Button>
            <Button onClick={reset}>
              Reset <Kbd>R</Kbd>
            </Button>
          </div>

          <div className={settings.mode === "light" ? "pointer-events-none opacity-40" : ""}>
            <div className="mb-1.5 flex items-baseline justify-between text-base">
              <span>Samples per pixel</span>
              <span className="font-mono">
                {readout.spp} / {sppText(settings.sppTarget)}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {SPP_OPTIONS.map((n) => (
                <Button key={n} onClick={() => update({ sppTarget: n, playing: true })} active={settings.sppTarget === n} className="px-0 py-1.5">
                  {sppText(n)}
                </Button>
              ))}
            </div>
          </div>

          <Slider
            label="How many times light may bounce"
            valueText={String(settings.maxBounces)}
            min={0}
            max={8}
            step={1}
            value={settings.maxBounces}
            onChange={(v) => update({ maxBounces: v })}
          />
          <Slider
            label="Lamp size"
            valueText={settings.lampRadius < 0.1 ? "tiny" : settings.lampRadius < 0.45 ? "medium" : "big"}
            min={LAMP_MIN_RADIUS}
            max={LAMP_MAX_RADIUS}
            step={0.002}
            value={settings.lampRadius}
            onChange={(v) => update({ lampRadius: v })}
          />
          <Slider
            label="Speed"
            valueText={`${settings.pathsPerFrame.toLocaleString("en-US")} paths / frame`}
            min={0}
            max={100}
            step={1}
            value={speedToSlider(settings.pathsPerFrame)}
            onChange={(v) => update({ pathsPerFrame: sliderToSpeed(v) })}
          />

          <div className="flex flex-col gap-3">
            <Toggle label="Show paths" checked={settings.showPaths} onChange={(v) => update({ showPaths: v })} shortcut="P" />
            <div className={settings.mode === "light" ? "pointer-events-none opacity-40" : ""}>
              <Toggle label="Advanced: also aim at the lamp each bounce" checked={settings.aimAtLamp} onChange={(v) => update({ aimAtLamp: v })} />
            </div>
          </div>

          <Button onClick={() => engine.resetLayout()} className="self-start py-1.5 text-sm">
            Put ball and lamp back
          </Button>

          <div className="mt-auto text-sm leading-relaxed text-text-muted">
            Keys: <span className="font-mono">1-6</span> stories · <span className="font-mono">N</span> next · <span className="font-mono">M</span> switch
            mode · <span className="font-mono">F</span> full screen · <span className="font-mono">Esc</span> clear pixel
          </div>
        </div>
      </div>
    </div>
  );
}
