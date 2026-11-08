// Waves on the map: Irish Shelf SWAN's wave-height frames, as
// force5/ingest/fetch_mi_swan.py publishes them with `--frames`
// (weather/mi-swan.json, one `swh` frame every `frameStepHours` over the
// Ireland crop of its 0.025° shelf grid, rounded to `framePrecision`), and a
// reader for the map's Waves layer to draw from. Nothing here draws.
//
// A frame is the sea the model solved at its hour, and wave heights are never
// interpolated between hours (waves.ts, WAVE_MATCH_HOURS). So an hour between
// two frames shows the nearer, and an hour before the run's first frame or
// after its last shows none.
//
// The reader fetches nothing until it is asked, then keeps the pointer for
// five minutes, as the forecast manifests are kept, and every frame it has
// read for as long as the run is the served one: stepping back through the
// hours reads nothing twice. A frame is some 200 KB of JSON, a few KB
// compressed.
import { runPath } from "./spotData";
import { forecastUrl } from "./urls";
import type { BundleFrame } from "./variables";
import { validateWaveManifest, type WaveManifest } from "./waves";
import type { Grid } from "./weather";

/** The run whose frames carry the waves, and the variable they carry. */
export const WAVE_FRAME_MODEL = "mi-swan";
export const WAVE_FRAME_URL = "weather/mi-swan.json";
export const WAVE_FRAME_VARIABLE = "swh";
/** The importer's bound on a published wave height, in metres. */
export const MAX_WAVE_HEIGHT_M = 25;
/** How long a read pointer is kept before it is asked for again. */
export const WAVE_POINTER_MS = 5 * 60000;
const HOUR_MS = 3600000;

export interface WaveFrame {
  model: string;
  run: string;
  hour: number;
  validTime: string;
  grid: Grid;
  /** Significant wave height in metres, rows north to south; null on land. */
  swh: (number | null)[];
}

/** A wave run that publishes height frames, as the map reads it. */
export type WaveFrameManifest = WaveManifest & {
  grid: Grid;
  frames: BundleFrame[];
};

/**
 * The run, when it publishes wave-height frames on a grid; null when it
 * publishes none (the frameless run of a job without `--frames`).
 */
export function waveFrameManifest(
  manifest: WaveManifest,
): WaveFrameManifest | null {
  const gridded = manifest.frameVariables ?? Object.keys(manifest.variables);
  return manifest.grid &&
    manifest.frames.length &&
    gridded.includes(WAVE_FRAME_VARIABLE)
    ? (manifest as WaveFrameManifest)
    : null;
}

/** Hours between a run's frames: their own step, or the series'. */
export const waveFrameStepHours = (manifest: WaveManifest) =>
  manifest.frameStepHours ?? manifest.stepHours;

/**
 * The frame the map shows at `time`: the nearest, within half a frame step
 * (the earlier of two equally near), and none outside the run's frames.
 */
export function waveFrameAt(
  manifest: WaveFrameManifest,
  time: number,
): BundleFrame | null {
  const frames = manifest.frames;
  const first = Date.parse(frames[0].validTime);
  const last = Date.parse(frames[frames.length - 1].validTime);
  if (!(time >= first && time <= last)) return null;
  const reach = (waveFrameStepHours(manifest) * HOUR_MS) / 2;
  let best: BundleFrame | null = null;
  let gap = Infinity;
  for (const frame of frames) {
    const distance = Math.abs(Date.parse(frame.validTime) - time);
    if (distance < gap) {
      best = frame;
      gap = distance;
    }
  }
  return gap <= reach ? best : null;
}

/** A frame's URL, beside its pointer. */
export const waveFrameUrl = (base: string, frame: BundleFrame) =>
  forecastUrl(runPath(WAVE_FRAME_URL, base, frame.url));

/**
 * A frame as published, or an error: this model's, the right run, hour and
 * grid, every cell a height inside the importer's bound (or null), at the
 * run's declared precision.
 */
export function validateWaveFrame(
  frame: WaveFrame,
  manifest: WaveFrameManifest,
  info: BundleFrame,
): WaveFrame {
  const grid = manifest.grid;
  const step = manifest.framePrecision?.[WAVE_FRAME_VARIABLE];
  const onStep = (value: number) =>
    step === undefined ||
    Math.abs(value / step - Math.round(value / step)) < 1e-6;
  const usable = (value: unknown) =>
    value === null ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= MAX_WAVE_HEIGHT_M &&
      onStep(value));
  if (
    !frame ||
    typeof frame !== "object" ||
    frame.model !== manifest.model ||
    frame.run !== manifest.run ||
    frame.hour !== info.hour ||
    Date.parse(frame.validTime) !== Date.parse(info.validTime) ||
    frame.grid?.width !== grid.width ||
    frame.grid?.height !== grid.height ||
    !Array.isArray(frame.swh) ||
    frame.swh.length !== grid.width * grid.height ||
    !frame.swh.every(usable)
  )
    throw new Error("Invalid wave frame. Refresh the wave forecast.");
  return frame;
}

/** A frame's heights for drawing: metres per cell, NaN where none is known. */
export function waveHeights(frame: Pick<WaveFrame, "swh">): Float32Array {
  const heights = new Float32Array(frame.swh.length);
  frame.swh.forEach((value, i) => {
    heights[i] = typeof value === "number" ? value : NaN;
  });
  return heights;
}

/** What the map gets for an hour. */
export interface WaveFrameAt {
  /** The run and frame shown, or null where there is nothing to draw. */
  manifest: WaveFrameManifest | null;
  frame: WaveFrame | null;
  /** Why nothing is drawn, for the map's information; null when it is. */
  note: string | null;
}

export interface WaveFrameReader {
  /** The served run when it publishes wave frames, else null. */
  manifest(): Promise<WaveFrameManifest | null>;
  /** One frame of the run, read once and kept for the run. */
  frame(manifest: WaveFrameManifest, info: BundleFrame): Promise<WaveFrame>;
  /** The frame the map shows at `time`, read on demand. */
  at(time: number): Promise<WaveFrameAt>;
}

/**
 * A reader over `read`, which fetches and parses one URL's JSON (and throws
 * on a failed answer). `now` is the clock the pointer's five minutes run on.
 */
export function waveFrameReader(
  read: (url: string) => Promise<unknown>,
  now: () => number = Date.now,
): WaveFrameReader {
  let pointer: {
    at: number;
    manifest: Promise<WaveFrameManifest | null>;
  } | null = null;
  let kept: { base: string; frames: Map<string, Promise<WaveFrame>> } = {
    base: "",
    frames: new Map(),
  };

  function manifest() {
    if (pointer && now() - pointer.at < WAVE_POINTER_MS)
      return pointer.manifest;
    const read_ = read(forecastUrl(WAVE_FRAME_URL))
      .then((m) => validateWaveManifest(m as WaveManifest))
      .then(waveFrameManifest)
      .catch(() => null);
    pointer = { at: now(), manifest: read_ };
    return read_;
  }

  function frame(run: WaveFrameManifest, info: BundleFrame) {
    // Another run starts afresh: its frames are other files.
    if (kept.base !== run.base) kept = { base: run.base, frames: new Map() };
    const url = waveFrameUrl(run.base, info);
    let found = kept.frames.get(url);
    if (!found) {
      const store = kept.frames;
      found = read(url).then((f) =>
        validateWaveFrame(f as WaveFrame, run, info),
      );
      // A failed read is not kept, so the next ask tries again.
      found.catch(() => store.delete(url));
      store.set(url, found);
    }
    return found;
  }

  async function at(time: number): Promise<WaveFrameAt> {
    const run = await manifest();
    if (!run)
      return {
        manifest: null,
        frame: null,
        note: "No wave map is published just now.",
      };
    const info = waveFrameAt(run, time);
    if (!info)
      return {
        manifest: run,
        frame: null,
        note: "The wave map does not reach this hour.",
      };
    try {
      return { manifest: run, frame: await frame(run, info), note: null };
    } catch {
      return {
        manifest: run,
        frame: null,
        note: "This hour's wave map could not be read.",
      };
    }
  }

  return { manifest, frame, at };
}
