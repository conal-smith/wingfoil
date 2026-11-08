import { describe, expect, it } from "vitest";
import { pointerOf, testGrid, waveManifest } from "./testing";
import {
  validateWaveFrame,
  waveFrameAt,
  waveFrameManifest,
  waveFrameReader,
  waveFrameStepHours,
  waveFrameUrl,
  waveHeights,
  WAVE_FRAME_URL,
  WAVE_POINTER_MS,
  type WaveFrame,
  type WaveFrameManifest,
} from "./waveFrames";
import { validateWaveManifest, waveHours } from "./waves";
import { variablesFrameHours } from "./variables";

const HOUR = 3600000;
const RUN_TIME = "2026-11-07T00:00:00Z";
const RUN = Date.parse(RUN_TIME);
const at = (hour: number) => new Date(RUN + hour * HOUR).toISOString();
const SERIES = Array.from({ length: 13 }, (_, hour) => hour);

/**
 * MI SWAN's pointer as it publishes with `--frames --frame-step 3`: hourly
 * series (in its squares), 3-hourly frames.
 */
function swan(extra: Record<string, unknown> = {}) {
  return pointerOf(
    waveManifest({
      model: "mi-swan",
      runTime: RUN_TIME,
      hours: SERIES,
      extra: {
        grid: testGrid,
        horizonHours: 12,
        frameStepHours: 3,
        frameVariables: ["swh"],
        framePrecision: { swh: 0.1 },
        frames: [0, 3, 6, 9, 12].map((hour) => ({
          hour,
          validTime: at(hour),
          url: `frames/${String(hour).padStart(3, "0")}.json`,
        })),
        ...extra,
      },
    }),
  );
}

const frameOf = (hour: number, swh: (number | null)[] = [1.2, null, 0, 3]) =>
  ({
    model: "mi-swan",
    run: "2026110700",
    hour,
    validTime: at(hour),
    grid: { ...testGrid, order: "north-to-south, west-to-east" },
    swh,
  }) as WaveFrame;

describe("a run whose frames are sparser than its series", () => {
  it("reads its series hourly and its frames every three hours", () => {
    const manifest = validateWaveManifest(swan());
    expect(waveHours(manifest)).toEqual(SERIES);
    expect(variablesFrameHours(manifest)).toEqual([0, 3, 6, 9, 12]);
    expect(waveFrameStepHours(manifest)).toBe(3);
  });

  it("is refused when its frames are off the declared step, horizon or variables", () => {
    for (const extra of [
      { frameStepHours: 6 },
      { frameStepHours: 2 },
      { horizonHours: 11 },
      { frames: swan().frames.slice(0, 4) },
      { framePrecision: { swh: 0 } },
      { framePrecision: { mwd: 0.1 } },
    ])
      expect(() => validateWaveManifest(swan(extra))).toThrow(
        /Invalid wave forecast manifest/,
      );
  });

  it("keeps a run without a frame step reading its frames on the series' hours", () => {
    const hourly = pointerOf(
      waveManifest({ hours: [0, 3, 6], withFrames: true }),
    );
    expect(variablesFrameHours(validateWaveManifest(hourly))).toEqual([
      0, 3, 6,
    ]);
    expect(waveFrameStepHours(hourly)).toBe(3);
  });
});

describe("the wave map's frames", () => {
  const manifest = waveFrameManifest(swan())!;

  it("are found only in a run that publishes heights on a grid", () => {
    expect(manifest).not.toBeNull();
    expect(waveFrameManifest(waveManifest({ model: "mi-swan" }))).toBeNull();
    expect(waveFrameManifest(swan({ frameVariables: ["mwd"] }))).toBeNull();
  });

  it("shows the nearer frame at an hour between two, never a blend of them", () => {
    expect(waveFrameAt(manifest, RUN)?.hour).toBe(0);
    expect(waveFrameAt(manifest, RUN + HOUR)?.hour).toBe(0);
    expect(waveFrameAt(manifest, RUN + 2 * HOUR)?.hour).toBe(3);
    // Equally near both: the earlier.
    expect(waveFrameAt(manifest, RUN + 1.5 * HOUR)?.hour).toBe(0);
    expect(waveFrameAt(manifest, RUN + 12 * HOUR)?.hour).toBe(12);
  });

  it("shows none before the run's first frame or after its last", () => {
    expect(waveFrameAt(manifest, RUN - HOUR)).toBeNull();
    expect(waveFrameAt(manifest, RUN + 13 * HOUR)).toBeNull();
  });

  it("sits in the run directory beside its pointer", () => {
    expect(waveFrameUrl(manifest.base, manifest.frames[1])).toMatch(
      new RegExp(`weather/${manifest.base}frames/003\\.json$`),
    );
  });
});

describe("a wave frame", () => {
  const manifest = waveFrameManifest(swan())!;
  const info = manifest.frames[1];

  it("is accepted with heights at a tenth of a metre and null on land", () => {
    const frame = frameOf(3);
    expect(validateWaveFrame(frame, manifest, info)).toBe(frame);
    expect(Array.from(waveHeights(frame))).toEqual([
      Math.fround(1.2),
      NaN,
      0,
      3,
    ]);
  });

  it("is refused for another model, run, hour or grid, or a height it cannot be", () => {
    const good = frameOf(3);
    for (const bad of [
      { ...good, model: "gfs-wave" },
      { ...good, run: "2026110600" },
      { ...good, hour: 6 },
      { ...good, validTime: at(4) },
      { ...good, grid: { ...good.grid, width: 4, height: 1 } },
      { ...good, swh: [1, 2, 3] },
      { ...good, swh: [-0.1, 0, 0, 0] },
      { ...good, swh: [26, 0, 0, 0] },
      { ...good, swh: [1.25, 0, 0, 0] },
      { ...good, swh: [NaN, 0, 0, 0] },
      { ...good, swh: ["1", 0, 0, 0] as unknown as number[] },
      null as unknown as WaveFrame,
    ])
      expect(() => validateWaveFrame(bad, manifest, info)).toThrow(
        /Invalid wave frame/,
      );
  });
});

describe("the wave frame reader", () => {
  /** A fake fetch over a served run: the pointer and its frames, counted. */
  function served(pointer: unknown, frames = new Map<string, unknown>()) {
    const asked: string[] = [];
    const read = async (url: string) => {
      asked.push(url);
      if (url.endsWith(WAVE_FRAME_URL)) return pointer;
      const hour = /frames\/(\d{3})\.json$/.exec(url)?.[1];
      if (hour === undefined || !frames.has(hour))
        throw new Error(`${url} answered 404`);
      return frames.get(hour);
    };
    return { read, asked };
  }
  const manifest = swan();
  const frames = new Map<string, unknown>([
    ["000", frameOf(0)],
    ["003", frameOf(3)],
  ]);

  it("reads the pointer and the frame an hour needs, and each only once", async () => {
    const { read, asked } = served(manifest, frames);
    const reader = waveFrameReader(read, () => 0);
    const shown = await reader.at(RUN + 2 * HOUR);
    expect(shown.note).toBeNull();
    expect(shown.frame?.hour).toBe(3);
    await reader.at(RUN + 3 * HOUR);
    await reader.at(RUN + 4 * HOUR);
    expect(asked.filter((url) => url.endsWith(WAVE_FRAME_URL))).toHaveLength(1);
    expect(asked.filter((url) => url.endsWith("003.json"))).toHaveLength(1);
  });

  it("asks for the pointer again once it is five minutes old", async () => {
    let clock = 0;
    const { read, asked } = served(manifest, frames);
    const reader = waveFrameReader(read, () => clock);
    await reader.manifest();
    clock = WAVE_POINTER_MS - 1;
    await reader.manifest();
    clock = WAVE_POINTER_MS;
    await reader.manifest();
    expect(asked).toHaveLength(2);
  });

  it("says why nothing is drawn: no frames, an hour past them, or a frame unread", async () => {
    const frameless = waveFrameReader(
      served(pointerOf(waveManifest({ model: "mi-swan" }))).read,
    );
    expect((await frameless.at(RUN)).note).toBe(
      "No wave map is published just now.",
    );
    const broken = waveFrameReader(served({ kind: "wave" }).read);
    expect((await broken.at(RUN)).manifest).toBeNull();
    const reader = waveFrameReader(served(manifest, frames).read);
    expect((await reader.at(RUN + 20 * HOUR)).note).toBe(
      "The wave map does not reach this hour.",
    );
    const missing = await reader.at(RUN + 6 * HOUR);
    expect(missing.frame).toBeNull();
    expect(missing.note).toBe("This hour's wave map could not be read.");
  });

  it("tries a frame again after a failed read, and refuses a broken one", async () => {
    const answers = new Map<string, unknown>();
    const { read, asked } = served(manifest, answers);
    const reader = waveFrameReader(read);
    const run = (await reader.manifest()) as WaveFrameManifest;
    await expect(reader.frame(run, run.frames[2])).rejects.toThrow();
    answers.set("006", { ...frameOf(6), swh: [1] });
    await expect(reader.frame(run, run.frames[2])).rejects.toThrow(
      /Invalid wave frame/,
    );
    answers.set("006", frameOf(6));
    expect((await reader.frame(run, run.frames[2])).hour).toBe(6);
    expect(asked.filter((url) => url.endsWith("006.json"))).toHaveLength(3);
  });
});
