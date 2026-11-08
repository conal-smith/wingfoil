import { describe, expect, it } from "vitest";
import { rainImage } from "./rain";
import {
  DAY_ABOVE,
  NIGHT_BELOW,
  SKY_ALPHA,
  darkness,
  gridDarkness,
  meanCloud,
  skyColour,
  skyImage,
  skyPalette,
} from "./sky";
import type { Grid } from "./weather";

/** The theme's colours (ui/theme.css), as getComputedStyle reads them. */
const THEME: Record<string, string> = {
  "--color-sky-c0": "#e9b200",
  "--color-sky-c30": "#f0d060",
  "--color-sky-c55": "#ddd6b8",
  "--color-sky-c78": "#bdbdc2",
  "--color-sky-c100": "#8f9096",
  "--map-sky-night": "#0b0c10",
  "--map-rain-drizzle": "rgba(96, 150, 196, 0.14)",
  "--map-rain-light": "rgba(64, 128, 186, 0.32)",
  "--map-rain-moderate": "rgba(38, 98, 170, 0.52)",
  "--map-rain-heavy": "rgba(24, 58, 140, 0.74)",
};
const palette = skyPalette((token) => THEME[token]);
const NIGHT = [11, 12, 16];
const near = (a: readonly number[], b: readonly number[], within = 3) =>
  a.slice(0, 3).every((v, i) => Math.abs(v - b[i]) <= within);

describe("how dark the sky is", () => {
  it("is day with the sun up, night once it is 6° under, and smooth between", () => {
    expect(darkness(DAY_ABOVE)).toBe(0);
    expect(darkness(40)).toBe(0);
    expect(darkness(NIGHT_BELOW)).toBe(1);
    expect(darkness(-30)).toBe(1);
    const dusk = darkness((DAY_ABOVE + NIGHT_BELOW) / 2);
    expect(dusk).toBeCloseTo(0.5, 5);
    expect(darkness(0)).toBeGreaterThan(0);
    expect(darkness(0)).toBeLessThan(dusk);
  });
});

describe("a cell's colour", () => {
  it("is the sun's yellow under a clear sky by day", () => {
    const clear = skyColour(palette, 0, 0, 0)!;
    expect(near(clear, [0xe9, 0xb2, 0x00], 0)).toBe(true);
    expect(clear[0]).toBeGreaterThan(clear[2] + 150);
    expect(clear[3]).toBe(SKY_ALPHA);
  });

  it("is grey under a full cover by day, and between the stops mixed", () => {
    const overcast = skyColour(palette, 100, 0, 0)!;
    expect(near(overcast, [0x8f, 0x90, 0x96], 0)).toBe(true);
    const broken = skyColour(palette, 66.5, 0, 0)!;
    // Halfway from 55 % to 78 %.
    expect(near(broken, [0xcd, 0xc9, 0xbd], 1)).toBe(true);
  });

  it("is near black at night, whatever the cloud", () => {
    for (const cloud of [0, 30, 55, 100])
      expect(near(skyColour(palette, cloud, 1, 0)!, NIGHT, 0)).toBe(true);
  });

  it("is between the day's and the night's at dusk", () => {
    const day = skyColour(palette, 0, 0, 0)!;
    const dusk = skyColour(palette, 0, darkness(-1.5), 0)!;
    expect(dusk[0]).toBeLessThan(day[0]);
    expect(dusk[0]).toBeGreaterThan(NIGHT[0]);
    expect(near(dusk, [(0xe9 + 11) / 2, (0xb2 + 12) / 2, 8], 1)).toBe(true);
  });

  it("is bluer with rain laid over the sky", () => {
    const dry = skyColour(palette, 55, 0, 0)!;
    const wet = skyColour(palette, 55, 0, 4)!;
    expect(wet[2] - wet[0]).toBeGreaterThan(dry[2] - dry[0]);
    expect(wet[3]).toBeGreaterThan(dry[3]);
  });

  it("is nothing where the cloud is unknown and it is dry, the rain alone where wet", () => {
    expect(skyColour(palette, null, 0, 0)).toBeNull();
    expect(skyColour(palette, NaN, 0, 0)).toBeNull();
    const rain = skyColour(palette, null, 0, 8)!;
    expect(near(rain, [24, 58, 140], 0)).toBe(true);
    expect(rain[3]).toBeCloseTo(0.74, 5);
  });
});

describe("the mean cloud of the frames shown", () => {
  const grid = { width: 3, height: 1 };
  it("averages cell by cell, unknown where any frame does not know it", () => {
    const mean = meanCloud(
      [{ clct: [0, 50, null] }, { clct: [100, 60, 40] }],
      grid,
    )!;
    expect([...mean.slice(0, 2)]).toEqual([50, 55]);
    expect(mean[2]).toBeNaN();
  });
  it("is none when a frame carries no cloud, or carries it malformed", () => {
    expect(meanCloud([{ clct: [0, 0, 0] }, {}], grid)).toBeNull();
    expect(meanCloud([{ clct: [0, 0] }], grid)).toBeNull();
    expect(meanCloud([], grid)).toBeNull();
  });
});

describe("the sky's picture", () => {
  // Ireland's longitudes and some way either side, 48° to 58° N: deeper
  // than the picture's feathered edge, so its middle is drawn in full.
  const grid: Grid = {
    width: 21,
    height: 11,
    west: -18,
    east: 2,
    north: 58,
    south: 48,
    dx: 1,
    dy: 1,
  };
  const cells = grid.width * grid.height;
  // A winter's dusk: the sun 6° under at 2° E and 3° over at 18° W.
  const DUSK = Date.parse("2026-12-21T16:20:00Z");
  const NOON = Date.parse("2026-12-21T12:30:00Z");
  const pixel = (
    image: ReturnType<typeof skyImage>,
    x: number,
    y = Math.floor(image.height / 2),
  ) => [
    ...image.data.slice(
      (y * image.width + x) * 4,
      (y * image.width + x) * 4 + 4,
    ),
  ];

  it("is dark in the east and lit in the west at the same instant", () => {
    const dark = gridDarkness(grid, DUSK);
    // The middle row, at 53° N.
    const row = 5 * grid.width;
    expect(dark[row + grid.width - 1]).toBeGreaterThan(0.99);
    expect(dark[row]).toBeLessThan(0.01);
    const image = skyImage(
      grid,
      new Float32Array(cells).fill(0),
      new Float32Array(cells).fill(0),
      DUSK,
      palette,
      4,
    );
    // At either end: faint in the feathered edge, but its colour its own.
    const west = pixel(image, 1);
    const east = pixel(image, image.width - 2);
    expect(near(west, [0xe9, 0xb2, 0x00], 6)).toBe(true);
    expect(near(east, NIGHT, 3)).toBe(true);
    // By day the whole of it is lit.
    const noon = skyImage(
      grid,
      new Float32Array(cells).fill(0),
      new Float32Array(cells).fill(0),
      NOON,
      palette,
      4,
    );
    expect(near(pixel(noon, noon.width - 2), [0xe9, 0xb2, 0x00], 1)).toBe(true);
  });

  it("is a little see-through, and leaves a cell of unknown cloud undrawn", () => {
    const cloud = new Float32Array(cells).fill(NaN);
    const image = skyImage(
      grid,
      cloud,
      new Float32Array(cells).fill(0),
      NOON,
      palette,
    );
    expect(image.data.every((v) => v === 0)).toBe(true);
    const known = skyImage(
      grid,
      new Float32Array(cells).fill(100),
      new Float32Array(cells).fill(0),
      NOON,
      palette,
      4,
    );
    expect(pixel(known, 40)[3]).toBe(Math.round(SKY_ALPHA * 255));
  });

  it("is the rain's own picture where the frames carry no cloud", () => {
    const rates = new Float32Array(cells).fill(0);
    rates[25] = 3;
    const sky = skyImage(grid, null, rates, NOON, palette);
    const rain = rainImage(grid, rates, palette.rain);
    expect(sky).toEqual(rain);
  });

  it("lays the rain over the sky", () => {
    const rates = new Float32Array(cells).fill(4);
    const wet = skyImage(
      grid,
      new Float32Array(cells).fill(55),
      rates,
      NOON,
      palette,
      4,
    );
    const dry = skyImage(
      grid,
      new Float32Array(cells).fill(55),
      new Float32Array(cells).fill(0),
      NOON,
      palette,
      4,
    );
    const [r, , b] = pixel(wet, 40);
    const [r0, , b0] = pixel(dry, 40);
    expect(b - r).toBeGreaterThan(b0 - r0);
  });
});
