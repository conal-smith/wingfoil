// What the Weather field draws at one hour, the sky's cloud and the rain over
// it, read on demand: imported by src/useRain.ts only once the field is on, so
// none of it is in the page a rider who just wants the wind loads. It reads
// the weather runs' pointers (kept for five minutes, as the forecast manifests
// are): ICON-EU's for its three days and GFS's past them (RAIN_URLS), and the
// frames the hour shown needs from whichever reaches it first, then the hours
// either side of it; every frame read is kept for the run, so going back
// through the hours reads nothing. An ICON-EU frame is some 25–30 KB on the
// wire, an hour's rain and total cloud over its whole crop; a GFS frame, on a
// grid a sixteenth the size, a few KB.
import {
  RAIN_URLS,
  RAIN_VARIABLE,
  framesCarryCloud,
  rainFrameUrl,
  rainIntervals,
  rainRates,
  rainReach,
  rainSourceFor,
  rainStart,
  validateRainFrame,
  type RainFrame,
  type RainView,
} from "../force5/src/rain";
import { meanCloud } from "../force5/src/sky";
import {
  validateWeatherManifest,
  type WeatherManifest,
} from "../force5/src/surface";
import type { BundleFrame } from "../force5/src/variables";
import { forecastUrl } from "../force5/src/urls";
import { clock, dayShort } from "./strip";

const MANIFEST_MS = 5 * 60000;
/** How many hours after the one shown are read behind it, and before it. */
const AHEAD = 3;
const BEHIND = 1;
/** How many runs' frames are kept: one each of ICON-EU's and GFS's, and the one before. */
const RUNS_KEPT = 4;

/** A weather run whose frames carry the rain, and the pointer it was read from. */
interface RainRun {
  pointer: string;
  manifest: WeatherManifest;
  frames: readonly BundleFrame[];
}

const pointers = new Map<
  string,
  { at: number; run: Promise<RainRun | null> }
>();
/** The frames of the runs being shown, by base and then url. */
const runs = new Map<string, Map<string, Promise<RainFrame>>>();

async function json(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

/** A pointer, when it publishes rain frames; null when none (or unreadable). */
function rainRun(pointer: string): Promise<RainRun | null> {
  const kept = pointers.get(pointer);
  if (kept && Date.now() - kept.at < MANIFEST_MS) return kept.run;
  const run = json(forecastUrl(pointer))
    .then((m) => validateWeatherManifest(m as WeatherManifest))
    .then((manifest) =>
      manifest.grid &&
      manifest.frames.length &&
      (manifest.frameVariables ?? Object.keys(manifest.variables)).includes(
        RAIN_VARIABLE,
      )
        ? { pointer, manifest, frames: manifest.frames }
        : null,
    )
    .catch(() => null);
  pointers.set(pointer, { at: Date.now(), run });
  return run;
}

function read(run: RainRun, info: BundleFrame) {
  const { manifest } = run;
  let read_ = runs.get(manifest.base);
  if (!read_) {
    read_ = new Map();
    runs.set(manifest.base, read_);
    // The oldest run read goes first: a pointer moved on has superseded it.
    while (runs.size > RUNS_KEPT) runs.delete(runs.keys().next().value!);
  }
  const url = rainFrameUrl(manifest.base, info, run.pointer);
  let frame = read_.get(url);
  if (!frame) {
    const kept = read_;
    frame = json(url).then((f) =>
      validateRainFrame(f as RainFrame, manifest, info),
    );
    frame.catch(() => kept.delete(url));
    kept.set(url, frame);
  }
  return frame;
}

/** The hours either side of the one shown, so a step through them is quick. */
function prefetch(run: RainRun, shown: readonly BundleFrame[]) {
  const at = run.frames.indexOf(shown[shown.length - 1]);
  const first = run.frames.indexOf(shown[0]);
  if (at < 0 || first < 0) return;
  for (const info of [
    ...run.frames.slice(at + 1, at + 1 + AHEAD),
    ...run.frames.slice(Math.max(0, first - BEHIND), first),
  ])
    void read(run, info).catch(() => undefined);
}

const when = (time: number) => `${dayShort(time)} ${clock(time)}`;

export interface RainAt {
  /** What the map draws, or null where there is nothing to draw. */
  view: RainView | null;
  /** Why nothing is drawn, said in the map's information; null when it is. */
  note: string | null;
  /** The last hour the rain map reaches, once the run is known. */
  reach: number | null;
}

/**
 * The rain the map shows for a column at `to` whose hours start at `from`:
 * the mean mm/h of the steps inside it (one, for an hourly column).
 */
export async function rainAt(from: number, to: number): Promise<RainAt> {
  const read_ = await Promise.all(RAIN_URLS.map(rainRun));
  const known = read_.filter((run): run is RainRun => run !== null);
  if (!known.length)
    return {
      view: null,
      note: "No rain forecast is published just now.",
      reach: null,
    };
  const reaches = known
    .map((run) => rainReach(run.frames))
    .filter((end): end is number => end !== null);
  const starts = known
    .map((run) => rainStart(run.frames))
    .filter((end): end is number => end !== null);
  const reach = reaches.length ? Math.max(...reaches) : null;
  const source = rainSourceFor(known, from, to);
  if (!source)
    return {
      view: null,
      note:
        starts.length && to < Math.min(...starts)
          ? `The rain map starts at ${when(Math.min(...starts))}.`
          : `The rain map reaches ${reach === null ? "no hour" : when(reach)}; not this hour.`,
      reach,
    };
  const { run, frames: shown } = source;
  const { manifest } = run;
  try {
    const frames = await Promise.all(shown.map((info) => read(run, info)));
    prefetch(run, shown);
    const spans = rainIntervals(shown);
    return {
      view: {
        // The hour too: the sky's night is worked out for it, and an hour
        // inside a longer step shows that step's rain under its own sun.
        key: `${manifest.base}|${shown.map((info) => info.hour).join(",")}|${to}`,
        grid: manifest.grid!,
        rates: rainRates(frames),
        // The sky's cloud, where the run's frames carry it; else the rain alone.
        cloud: framesCarryCloud(manifest)
          ? meanCloud(frames, manifest.grid!)
          : null,
        from: spans[0].start,
        to: spans[spans.length - 1].end,
        time: to,
      },
      note: null,
      reach,
    };
  } catch {
    return {
      view: null,
      note: "This hour's rain could not be read.",
      reach,
    };
  }
}
