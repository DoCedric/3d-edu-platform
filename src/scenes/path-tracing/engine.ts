/**
 * Simulation state for the Path Tracing Playground: progressive rendering in
 * time-boxed batches, the step-by-step single path, and the list of recent
 * paths to draw. Framework-free; the React page owns one instance and the
 * canvas drawing code only reads from it.
 */

import {
  Accumulator,
  BALL_RADIUS,
  buildScene,
  constrainBall,
  DEFAULT_PARAMS,
  PIXEL_COUNT,
  traceCameraPath,
  traceLightPath,
  type PathRecord,
  type Rgb,
  type Scene,
  type Vec2,
} from "./pathTracer";

export type TraceMode = "camera" | "light";

export interface Settings {
  mode: TraceMode;
  maxBounces: number;
  lampRadius: number;
  aimAtLamp: boolean;
  showPaths: boolean;
  /** Stop once every pixel has this many samples. Infinity = never stop. */
  sppTarget: number;
  /** How many paths to trace per animation frame (capped by a time budget). */
  pathsPerFrame: number;
  playing: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: "camera",
  maxBounces: 4,
  lampRadius: DEFAULT_PARAMS.lampRadius,
  aimAtLamp: false,
  showPaths: true,
  sppTarget: 64,
  pathsPerFrame: 24,
  playing: true,
};

/** A recently traced path, kept around briefly so it can be drawn fading out. */
export interface DrawnPath {
  record: PathRecord;
  born: number;
}

export interface StepState {
  record: PathRecord;
  /** Index of the event currently shown. */
  eventIndex: number;
  /** When the current event started showing (drives the growing-ray animation). */
  eventStart: number;
  /** Light the finished path delivers to its pixel (camera mode). */
  radiance: Rgb;
  /** Whether the finished path has been added to the image yet. */
  applied: boolean;
}

export interface Readout {
  spp: number;
  cameraPaths: number;
  lightPaths: number;
  lightReached: number;
  done: boolean;
}

/** Recent paths older than this (ms) are gone. */
export const PATH_LIFETIME = 1600;
const MAX_DRAWN_PATHS = 200;
/** Paths recorded for drawing per frame, so the room never turns into a solid scribble. */
const RECORDS_PER_FRAME = 1;
/** Light-path mode: at most this many successful paths on screen at once. */
const MAX_VISIBLE_LIGHT_HITS = 3;
/** Milliseconds of tracing allowed per frame, to keep ~60 fps. */
const FRAME_BUDGET_MS = 9;
/** Paths traced between clock checks. */
const CHUNK = 32;

/** The two things you can drag around the room. */
export type Draggable = "ball" | "lamp";

export class PathTracingEngine {
  settings: Settings = { ...DEFAULT_SETTINGS };
  private lampCenter: Vec2 = DEFAULT_PARAMS.lampCenter;
  private ballCenter: Vec2 = DEFAULT_PARAMS.ballCenter;
  scene: Scene = buildScene(DEFAULT_PARAMS);
  readonly pixelCount = PIXEL_COUNT;

  /** Camera-path image. */
  readonly image = new Accumulator(PIXEL_COUNT);
  cameraPaths = 0;
  /** Number of complete passes over all pixels = samples per pixel. */
  passes = 0;
  private cursor = 0;

  /** Light-path mode: how much light landed in each pixel, and how often. */
  readonly lightHitCounts = new Uint32Array(PIXEL_COUNT);
  readonly lightHitSums = new Float64Array(PIXEL_COUNT * 3);
  lightPaths = 0;
  lightReached = 0;

  /** Selected pixel (-1 = none). Only that pixel's paths are drawn while selected. */
  selected = -1;
  drawnPaths: DrawnPath[] = [];
  step: StepState | null = null;

  /** Applies new settings. Anything that changes the picture resets the image. */
  configure(next: Settings) {
    const prev = this.settings;
    this.settings = next;
    if (next.lampRadius !== prev.lampRadius) {
      // A bigger lamp may no longer fit where it was.
      this.lampCenter = constrainBall(this.lampCenter, next.lampRadius, { center: this.ballCenter, radius: BALL_RADIUS });
      this.rebuildScene();
    }
    if (
      next.mode !== prev.mode ||
      next.maxBounces !== prev.maxBounces ||
      next.lampRadius !== prev.lampRadius ||
      next.aimAtLamp !== prev.aimAtLamp
    ) {
      this.reset();
    }
    if (next.playing) this.step = null;
    if (!next.showPaths) this.drawnPaths = [];
  }

  private rebuildScene() {
    this.scene = buildScene({ lampRadius: this.settings.lampRadius, lampCenter: this.lampCenter, ballCenter: this.ballCenter });
  }

  /** Moves the ball or the lamp (kept inside the room and apart), and restarts the image. */
  moveObject(which: Draggable, pos: Vec2) {
    if (which === "ball") {
      this.ballCenter = constrainBall(pos, BALL_RADIUS, { center: this.lampCenter, radius: this.settings.lampRadius });
    } else {
      this.lampCenter = constrainBall(pos, this.settings.lampRadius, { center: this.ballCenter, radius: BALL_RADIUS });
    }
    this.rebuildScene();
    this.reset();
  }

  /** Puts the ball and lamp back where they started. */
  resetLayout() {
    this.ballCenter = DEFAULT_PARAMS.ballCenter;
    this.lampCenter = constrainBall(DEFAULT_PARAMS.lampCenter, this.settings.lampRadius, { center: this.ballCenter, radius: BALL_RADIUS });
    this.rebuildScene();
    this.reset();
  }

  /** Selects a pixel (-1 = none). Only that pixel's paths are drawn while selected. */
  select(pixel: number) {
    this.selected = pixel;
    this.drawnPaths = [];
  }

  /** Clicking the selected pixel again deselects it. */
  toggleSelect(pixel: number) {
    this.select(this.selected === pixel ? -1 : pixel);
  }

  /** Drops the step-by-step path so the next step starts a fresh one. */
  clearStep() {
    this.step = null;
  }

  /** Clears the image, counters, and drawn paths. */
  reset() {
    this.image.reset();
    this.cameraPaths = 0;
    this.passes = 0;
    this.cursor = 0;
    this.lightHitCounts.fill(0);
    this.lightHitSums.fill(0);
    this.lightPaths = 0;
    this.lightReached = 0;
    this.drawnPaths = [];
    this.step = null;
  }

  get done(): boolean {
    return this.settings.mode === "camera" && this.passes >= this.settings.sppTarget;
  }

  readout(): Readout {
    return {
      spp: this.passes,
      cameraPaths: this.cameraPaths,
      lightPaths: this.lightPaths,
      lightReached: this.lightReached,
      done: this.done,
    };
  }

  /** Called once per animation frame. */
  update(now: number) {
    this.drawnPaths = this.drawnPaths.filter((p) => now - p.born < PATH_LIFETIME);
    if (!this.settings.playing || this.step) return;

    const start = performance.now();
    let budget = this.settings.pathsPerFrame;
    let records = this.settings.showPaths ? RECORDS_PER_FRAME : 0;

    while (budget > 0 && !this.done) {
      const n = Math.min(CHUNK, budget);
      for (let i = 0; i < n; i++) {
        if (this.settings.mode === "camera") {
          const pixel = this.cursor;
          const wantRecord = records > 0 && (this.selected < 0 || this.selected === pixel);
          const sample = traceCameraPath(this.scene, pixel, this.settings, wantRecord);
          this.addCameraSample(pixel, sample.radiance);
          if (sample.path) {
            this.pushDrawn(sample.path, now);
            records--;
          }
          if (this.done) break;
        } else {
          // Paths that reach the camera are rare and important, so they are
          // always drawn - but only a few at once, or the room would suggest
          // that lots of light gets there. Misses use the per-frame budget.
          const sample = traceLightPath(this.scene, this.settings, this.settings.showPaths);
          this.addLightSample(sample.pixel, sample.color);
          if (sample.path) {
            const keep = sample.path.success ? this.visibleLightHits() < MAX_VISIBLE_LIGHT_HITS : records > 0;
            if (keep) this.pushDrawn(sample.path, now);
            if (keep && !sample.path.success) records--;
          }
        }
      }
      budget -= n;
      if (performance.now() - start > FRAME_BUDGET_MS) break;
    }
  }

  private visibleLightHits(): number {
    let n = 0;
    for (const p of this.drawnPaths) if (p.record.success) n++;
    return n;
  }

  private addCameraSample(pixel: number, radiance: Rgb) {
    this.image.add(pixel, radiance);
    this.cameraPaths++;
    if (pixel === this.cursor) {
      this.cursor++;
      if (this.cursor >= this.pixelCount) {
        this.cursor = 0;
        this.passes++;
      }
    }
  }

  private addLightSample(pixel: number, color: Rgb) {
    this.lightPaths++;
    if (pixel < 0) return;
    this.lightReached++;
    this.lightHitCounts[pixel]++;
    for (let c = 0; c < 3; c++) this.lightHitSums[pixel * 3 + c] += color[c];
  }

  private pushDrawn(record: PathRecord, now: number) {
    this.drawnPaths.push({ record, born: now });
    if (this.drawnPaths.length > MAX_DRAWN_PATHS) this.drawnPaths.splice(0, this.drawnPaths.length - MAX_DRAWN_PATHS);
  }

  /**
   * Step mode: starts a new single path, or shows its next event. Pauses
   * progressive rendering. Returns the caption to show.
   */
  advanceStep(now: number): string {
    this.settings = { ...this.settings, playing: false };
    const step = this.step;
    if (!step || step.eventIndex >= step.record.events.length - 1) {
      this.startStep(now);
    } else {
      step.eventIndex++;
      step.eventStart = now;
      if (step.eventIndex === step.record.events.length - 1) this.applyStep(step);
    }
    const current = this.step!;
    return current.record.events[current.eventIndex].caption;
  }

  private startStep(now: number) {
    let record: PathRecord | null;
    let radiance: Rgb = [0, 0, 0];
    if (this.settings.mode === "camera") {
      if (this.selected < 0) this.selected = Math.floor(this.pixelCount / 2);
      const sample = traceCameraPath(this.scene, this.selected, this.settings, true);
      record = sample.path;
      radiance = sample.radiance;
    } else {
      record = traceLightPath(this.scene, this.settings, true).path;
    }
    this.drawnPaths = [];
    this.step = { record: record!, eventIndex: 0, eventStart: now, radiance, applied: false };
  }

  /** The finished step path counts as a real sample. */
  private applyStep(step: StepState) {
    if (step.applied) return;
    step.applied = true;
    if (this.settings.mode === "camera") {
      this.image.add(step.record.pixel, step.radiance);
      this.cameraPaths++;
    } else {
      const last = step.record.colors[step.record.colors.length - 1];
      this.addLightSample(step.record.success ? step.record.pixel : -1, last);
    }
  }
}
