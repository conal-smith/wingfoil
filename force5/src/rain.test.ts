import { describe, expect, it } from "vitest";
import {
  CLOUD_FRAME_STEP,
  CLOUD_VARIABLE,
  DRY_MM_PER_HOUR,
  RAIN_KEY_MM,
  RAIN_STOPS,
  RAIN_URLS,
  frameCloud,
  framesCarryCloud,
  rainColour,
  rainFigure,
  rainFrameAt,
  rainFramesFor,
  rainImage,
  rainIntervals,
  rainRamp,
  rainRates,
  rainReach,
  rainSourceFor,
  rainStart,
  rainTint,
  stepCovering,
  stepsWithin,
  validateRainFrame,
  type RainFrame,
} from "./rain";
import type { Grid } from "./weather";

const HOUR = 3600000;
const RUN = Date.parse("2026-10-24T00:00:00Z");
const at = (hour: number) => new Date(RUN + hour * HOUR).toISOString();
/** A run's frames as published: hour 0 with no interval, then each step's own. */
const frames = (hours: number[]) =>
  hours.map((hour, k) => ({
    hour,
    validTime: at(hour),
    url: `frames/${String(hour).padStart(3, "0")}.json`,
    precipIntervalHours: k ? ([hours[k - 1], hour] as [number, number]) : null,
  }));

/** The theme's stops (ui/theme.css), as getComputedStyle reads them. */
const THEME: Record<string, string> = {
  "--map-rain-drizzle": "rgba(96, 150, 196, 0.14)",
  "--map-rain-light": "rgba(64, 128, 186, 0.32)",
  "--map-rain-moderate": "rgba(38, 98, 170, 0.52)",
  "--map-rain-heavy": "rgba(24, 58, 140, 0.74)",
};
const ramp = rainRamp((token) => THEME[token]);

describe("a step's rain belongs to its own interval", () => {
  const hourly = frames([0, 1, 2, 3, 4, 5, 6]);
  const intervals = rainIntervals(hourly);

  it("reads each interval from the step, and none at initialization", () => {
    expect(intervals[0]).toEqual({ start: RUN, end: RUN });
    expect(intervals[2]).toEqual({ start: RUN + HOUR, end: RUN + 2 * HOUR });
    // Unstated, it is the gap to the step before.
    const bare = rainIntervals([
      { validTime: at(0) },
      { validTime: at(3) },
      { validTime: at(6) },
    ]);
    expect(bare[2]).toEqual({ start: RUN + 3 * HOUR, end: RUN + 6 * HOUR });
  });

  it("finds the hourly steps inside a column's hours", () => {
    // An hourly column at 02:00 reads the hour 01–02 and nothing else.
    expect(stepsWithin(intervals, RUN + HOUR, RUN + 2 * HOUR)).toEqual([2]);
    // A three-hourly column at 06:00 reads 03–04, 04–05 and 05–06.
    expect(stepsWithin(intervals, RUN + 3 * HOUR, RUN + 6 * HOUR)).toEqual([
      4, 5, 6,
    ]);
    // Initialization's step has no interval, so no column reads it.
    expect(stepsWithin(intervals, RUN - HOUR, RUN)).toEqual([]);
  });

  it("gives an hour inside a longer interval that interval, and none past the run", () => {
    const coarse = rainIntervals(frames([0, 3, 6]));
    expect(stepCovering(coarse, RUN + 2 * HOUR)).toBe(1);
    expect(stepCovering(coarse, RUN + 3 * HOUR)).toBe(1);
    expect(stepCovering(coarse, RUN + 4 * HOUR)).toBe(2);
    expect(stepCovering(coarse, RUN)).toBeNull();
    expect(stepCovering(coarse, RUN + 7 * HOUR)).toBeNull();
  });

  it("picks the frames the map shows for an hour, or for a column of hours", () => {
    expect(rainFrameAt(hourly, RUN + 4 * HOUR)?.hour).toBe(4);
    expect(rainFrameAt(hourly, RUN)).toBeNull();
    expect(rainFrameAt(hourly, RUN + 9 * HOUR)).toBeNull();
    expect(
      rainFramesFor(hourly, RUN + 3 * HOUR, RUN + 6 * HOUR).map((f) => f.hour),
    ).toEqual([4, 5, 6]);
    // A three-hourly run under an hourly column: the step that holds the hour.
    expect(
      rainFramesFor(frames([0, 3, 6]), RUN + 3 * HOUR, RUN + 4 * HOUR).map(
        (f) => f.hour,
      ),
    ).toEqual([6]);
  });
});

describe("past ICON-EU's three days, the map goes on in GFS", () => {
  /** A run's frames from `start` hours after RUN, at the hours of its ladder. */
  const run = (name: string, start: number, hours: number[]) => ({
    name,
    frames: hours.map((hour, k) => ({
      hour,
      validTime: at(start + hour),
      url: `frames/${String(hour).padStart(3, "0")}.json`,
      precipIntervalHours: k
        ? ([hours[k - 1], hour] as [number, number])
        : null,
    })),
  });
  const range = (from: number, to: number, step = 1) =>
    Array.from({ length: (to - from) / step + 1 }, (_, k) => from + k * step);
  // As production published them: ICON-EU's 00 UTC run to +72 h, GFS's
  // 06 UTC run hourly to +120 h and three-hourly to +384 h.
  const icon = run("icon", 0, range(0, 72));
  const gfs = run("gfs", 6, [...range(0, 120), ...range(123, 384, 3)]);
  const runs = [icon, gfs];
  const source = (from: number, to: number) => {
    const found = rainSourceFor(runs, RUN + from * HOUR, RUN + to * HOUR);
    return found && [found.run.name, found.frames.map((f) => f.hour)];
  };

  it("reads ICON-EU first and GFS second, as the dock does", () => {
    expect(RAIN_URLS).toEqual([
      "weather/icon-eu-weather.json",
      "weather/gfs-weather.json",
    ]);
  });

  it("draws ICON-EU's hours for its three days", () => {
    expect(source(13, 14)).toEqual(["icon", [14]]);
    expect(source(71, 72)).toEqual(["icon", [72]]);
    expect(rainReach(icon.frames)).toBe(RUN + 72 * HOUR);
    expect(rainStart(icon.frames)).toBe(RUN + 1 * HOUR);
  });

  it("draws every hour after them from GFS, not nothing", () => {
    // The first hour past ICON-EU's reach is GFS's, hour 67 of its run.
    expect(source(72, 73)).toEqual(["gfs", [67]]);
    // A column straddling the hand-over is drawn whole by GFS.
    expect(source(70, 73)).toEqual(["gfs", [65, 66, 67]]);
    // Day four, five and six at midday.
    for (const day of [3, 4, 5]) {
      const found = source(day * 24 + 11, day * 24 + 12);
      expect(found?.[0]).toBe("gfs");
    }
    // Past GFS's +120 h an hour is inside a three-hour step, which holds it.
    expect(source(6 + 121, 6 + 122)).toEqual(["gfs", [123]]);
    expect(source(6 + 384, 6 + 385)).toBeNull();
  });

  it("with GFS's frames not yet published, stops at ICON-EU's reach", () => {
    const found = rainSourceFor([icon], RUN + 72 * HOUR, RUN + 73 * HOUR);
    expect(found).toBeNull();
  });
});

describe("the rate the map draws", () => {
  const frame = (hour: number, span: number, precip: (number | null)[]) => ({
    validTime: at(hour),
    precipIntervalHours: [hour - span, hour] as [number, number],
    precip,
  });

  it("is each hour's own amount, and a column's mean per hour", () => {
    expect([...rainRates([frame(1, 1, [0, 1.2, 0.3])])]).toEqual([
      0,
      expect.closeTo(1.2, 5),
      expect.closeTo(0.3, 5),
    ]);
    const mean = rainRates([
      frame(4, 1, [0.3, 3]),
      frame(5, 1, [0.6, 0]),
      frame(6, 1, [0, 0]),
    ]);
    expect(mean[0]).toBeCloseTo(0.3, 5);
    expect(mean[1]).toBeCloseTo(1, 5);
    // A three-hour total is a third of it an hour.
    expect(rainRates([frame(6, 3, [2.4])])[0]).toBeCloseTo(0.8, 5);
  });

  it("leaves a cell any frame does not know unknown, not dry", () => {
    const rates = rainRates([frame(1, 1, [null, 1]), frame(2, 1, [1, 1])]);
    expect(Number.isNaN(rates[0])).toBe(true);
    expect(rates[1]).toBeCloseTo(1, 5);
  });
});

describe("the colours", () => {
  it("are the theme's four stops, with a key from drizzle to heavy", () => {
    expect(RAIN_STOPS.map((stop) => stop.token)).toEqual(Object.keys(THEME));
    expect(ramp[0].rgba).toEqual([96, 150, 196, 0.14]);
    expect(RAIN_KEY_MM[0]).toBe(0.1);
  });

  it("read the theme as the built page gives it back, alpha and all", () => {
    // The minifier writes rgba(24, 58, 140, 0.74) as #183a8cbd.
    const built = rainRamp((token) =>
      token === "--map-rain-heavy" ? "#183a8cbd" : THEME[token],
    );
    const [r, g, b, a] = built[3].rgba;
    expect([r, g, b]).toEqual([24, 58, 140]);
    expect(a).toBeCloseTo(0.74, 2);
  });

  it("draw nothing where it is dry or unknown", () => {
    expect(rainColour(ramp, 0)).toBeNull();
    expect(rainColour(ramp, 0.01)).toBeNull();
    expect(rainColour(ramp, NaN)).toBeNull();
    // Between a dry cell and a wet one, the drizzle fades in.
    const edge = rainColour(ramp, DRY_MM_PER_HOUR)!;
    expect(edge[3]).toBeGreaterThan(0);
    expect(edge[3]).toBeLessThan(ramp[0].rgba[3]);
  });

  it("are barely there in drizzle and strong in heavy rain", () => {
    expect(rainColour(ramp, 0.1)![3]).toBeLessThan(0.2);
    expect(rainColour(ramp, 20)![3]).toBeGreaterThan(0.7);
    // Every step wetter is at least as strong.
    const alphas = [0.1, 0.2, 0.5, 1, 2, 4, 8, 16].map(
      (mm) => rainColour(ramp, mm)![3],
    );
    for (let i = 1; i < alphas.length; i++)
      expect(alphas[i]).toBeGreaterThanOrEqual(alphas[i - 1]);
  });

  it("follow the logarithm between two stops", () => {
    // 1 mm is halfway from 0.5 to 2 on a log scale, so halfway in colour.
    const mid = rainColour(ramp, 1)!;
    expect(mid[3]).toBeCloseTo((0.32 + 0.52) / 2, 5);
    expect(mid[0]).toBeCloseTo((64 + 38) / 2, 5);
  });
});

describe("the layer's picture", () => {
  // 4 × 3 cells, 1° apart, north at 56°.
  const grid: Grid = {
    width: 4,
    height: 3,
    west: -10,
    east: -7,
    north: 56,
    south: 54,
    dx: 1,
    dy: 1,
  };

  it("covers the grid, on rows even in Mercator", () => {
    const image = rainImage(grid, new Float32Array(12).fill(2), ramp, 4);
    expect(image.width).toBe(16);
    // More rows than a latitude grid's 3 × 4: the north's cells are taller.
    expect(image.height).toBeGreaterThan(12);
    expect(image.data).toHaveLength(image.width * image.height * 4);
    expect(image.coordinates).toEqual([
      [-10, 56],
      [-7, 56],
      [-7, 54],
      [-10, 54],
    ]);
  });

  it("is clear where it is dry and coloured where it rains, fading at the edge", () => {
    const rates = new Float32Array([0, 0, 0, 0, 0, 4, 4, 0, 0, 0, 0, 0]);
    const image = rainImage(grid, rates, ramp, 8);
    const alpha = (x: number, y: number) =>
      image.data[(y * image.width + x) * 4 + 3];
    // The corner is dry: nothing drawn.
    expect(alpha(0, 0)).toBe(0);
    // Round the wet cells in the middle, the blue.
    const middle = alpha(image.width / 2, Math.round(image.height / 2));
    expect(middle).toBeGreaterThan(0);
    const [r, g, b] = [0, 1, 2].map(
      (c) =>
        image.data[
          (Math.round(image.height / 2) * image.width + image.width / 2) * 4 + c
        ],
    );
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });

  it("leaves an unknown cell undrawn rather than dry", () => {
    const image = rainImage(grid, new Float32Array(12).fill(NaN), ramp);
    expect(image.data.every((value) => value === 0)).toBe(true);
  });
});

describe("a rain frame as published", () => {
  const manifest = {
    run: "2026102400",
    grid: { width: 2, height: 1 } as Grid,
  };
  const info = frames([0, 1])[1];
  const good: RainFrame = {
    model: "icon-eu-weather",
    run: "2026102400",
    hour: 1,
    validTime: at(1),
    grid: manifest.grid,
    precipIntervalHours: [0, 1],
    precip: [0, 1.4],
  };

  it("is accepted with the run's hour and size, and amounts in range", () => {
    expect(validateRainFrame(good, manifest, info)).toBe(good);
    expect(
      validateRainFrame({ ...good, precip: [null, null] }, manifest, info),
    ).toBeTruthy();
  });

  it("is refused for another run, hour, size or a negative amount", () => {
    for (const bad of [
      { ...good, run: "2026102318" },
      { ...good, hour: 2 },
      { ...good, precip: [1] },
      { ...good, precip: [-0.1, 0] },
      { ...good, precip: [0, "1"] as unknown as number[] },
    ])
      expect(() => validateRainFrame(bad, manifest, info)).toThrow(
        /Invalid rain frame/,
      );
  });

  it("keeps its rain whatever its cloud, which is checked on its own", () => {
    for (const clct of [[0, 100], [101, 0], [50], [null, -1]])
      expect(
        validateRainFrame({ ...good, clct }, manifest, info).precip,
      ).toEqual([0, 1.4]);
  });
});

describe("the total cloud in a frame", () => {
  const grid = { width: 2, height: 2 };
  const frame = (clct: unknown) => ({ clct }) as Pick<RainFrame, "clct">;

  it("reads per cent per cell, a clear 0 kept apart from an unknown null", () => {
    // Published in steps of 5 %, and read as the per cent it is, not a count.
    expect(CLOUD_FRAME_STEP).toBe(5);
    expect(frameCloud(frame([0, 35, 100, null]), grid)).toEqual([
      0,
      35,
      100,
      null,
    ]);
  });

  it("is none for a run published before the frames carried it", () => {
    expect(frameCloud(frame(undefined), grid)).toBeNull();
  });

  it("is none, not an error, for the wrong size or a value off the scale", () => {
    for (const bad of [
      [0, 0, 0],
      [0, 0, 0, 101],
      [0, -1, 0, 0],
      [0, "50", 0, 0],
      [0, Number.NaN, 0, 0],
      "overcast",
    ])
      expect(frameCloud(frame(bad), grid)).toBeNull();
  });

  it("is declared by the run's frame variables", () => {
    const variables = { precip: {}, clct: {}, t2m: {} };
    expect(CLOUD_VARIABLE).toBe("clct");
    expect(
      framesCarryCloud({ variables, frameVariables: ["precip", "clct"] }),
    ).toBe(true);
    expect(framesCarryCloud({ variables, frameVariables: ["precip"] })).toBe(
      false,
    );
    // No narrowing: the frames carry every variable, cloud among them.
    expect(framesCarryCloud({ variables })).toBe(true);
  });
});

describe("the dock's figures", () => {
  it("print an hour's rain, dry as 0 and a trace as under a tenth", () => {
    expect(rainFigure(0, 0)).toBe("0");
    expect(rainFigure(1.24, 1.24)).toBe("1.2");
    // 0.1 mm over three hours is rain, not none.
    expect(rainFigure(0.1 / 3, 0.1)).toBe("<0.1");
  });

  it("tint a light hour faintly and a heavy one fully", () => {
    expect(rainTint(0)).toBe(0);
    expect(rainTint(0.2)).toBeGreaterThan(0.15);
    expect(rainTint(0.2)).toBeLessThan(0.3);
    expect(rainTint(1)).toBeCloseTo(0.5, 5);
    expect(rainTint(4)).toBe(1);
    expect(rainTint(12)).toBe(1);
  });
});
