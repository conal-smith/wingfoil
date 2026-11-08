// What the Waves field draws at one hour, read on demand: imported by
// src/useWaves.ts only once the field is on, or once the page is idle to ask
// whether there is a wave map at all, so none of it is in the first paint.
// It reads Irish Shelf SWAN's pointer and the frame the hour shown needs
// through force5/src/waveFrames.ts, which keeps both, then the frames either
// side of it, so a step through the hours is quick.
import {
  waveFrameAt,
  waveFrameReader,
  waveHeights,
  type WaveFrame,
  type WaveFrameManifest,
} from "../force5/src/waveFrames";
import type { WaveView } from "../force5/src/waveField";
import { clock, dayShort } from "./strip";

async function json(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

const reader = waveFrameReader(json);

/** A frame's view, made once: the same frame is the same picture. */
const views = new WeakMap<WaveFrame, WaveView>();

const when = (time: number) => `${dayShort(time)} ${clock(time)}`;

export interface WavesAt {
  /** What the map draws, or null where there is nothing to draw. */
  view: WaveView | null;
  /** Why nothing is drawn, for the map's legend; null when it is. */
  note: string | null;
  /** The last hour the wave map reaches, once the run is known. */
  reach: number | null;
}

/** The frames either side of the one shown, read behind it. */
function prefetch(run: WaveFrameManifest, time: number) {
  const shown = waveFrameAt(run, time);
  const at = shown ? run.frames.indexOf(shown) : -1;
  if (at < 0) return;
  for (const info of [run.frames[at + 1], run.frames[at - 1]])
    if (info) void reader.frame(run, info).catch(() => undefined);
}

/** The wave height the map shows at `time`: the nearest frame's. */
export async function wavesAt(time: number): Promise<WavesAt> {
  const found = await reader.at(time);
  const run = found.manifest;
  if (!run) return { view: null, note: found.note, reach: null };
  const first = Date.parse(run.frames[0].validTime);
  const reach = Date.parse(run.frames[run.frames.length - 1].validTime);
  const frame = found.frame;
  if (!frame)
    return {
      view: null,
      note:
        time < first
          ? `The wave map starts at ${when(first)}.`
          : time > reach
            ? `The wave map reaches ${when(reach)}; not this hour.`
            : found.note,
      reach,
    };
  prefetch(run, time);
  let view = views.get(frame);
  if (!view) {
    view = {
      key: `${run.base}|${frame.hour}`,
      grid: run.grid,
      heights: waveHeights(frame),
      time: Date.parse(frame.validTime),
    };
    views.set(frame, view);
  }
  return { view, note: null, reach };
}

/** Whether the served wave run publishes frames for the map. */
export async function wavesPublished(): Promise<boolean> {
  return (await reader.manifest()) !== null;
}
