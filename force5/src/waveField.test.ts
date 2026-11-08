import { describe, expect, it } from "vitest";
import {
  WAVE_ALPHA,
  WAVE_STOPS,
  waveColour,
  waveImage,
  waveRamp,
} from "./waveField";
import type { Grid } from "./weather";

/** The light theme's stops (ui/theme.css), as getComputedStyle reads them. */
const THEME: Record<string, string> = {
  "--color-waves-m0": "#c9ece4",
  "--color-waves-m05": "#86d8cb",
  "--color-waves-m1": "#3fb6b4",
  "--color-waves-m2": "#1f83a8",
  "--color-waves-m3": "#2a55a3",
  "--color-waves-m5": "#3b2c8e",
  "--color-waves-m8": "#27105e",
};
const ramp = waveRamp((token) => THEME[token]);

describe("the wave height's colour", () => {
  it("reads every stop from the theme, from flat water to 8 m", () => {
    expect(WAVE_STOPS.map((stop) => stop.metres)).toEqual([
      0, 0.5, 1, 2, 3, 5, 8,
    ]);
    expect(waveColour(ramp, 0)).toEqual([0xc9, 0xec, 0xe4, 1]);
    expect(waveColour(ramp, 0.5)).toEqual([0x86, 0xd8, 0xcb, 1]);
    expect(waveColour(ramp, 2)).toEqual([0x1f, 0x83, 0xa8, 1]);
    expect(waveColour(ramp, 8)).toEqual([0x27, 0x10, 0x5e, 1]);
  });

  it("mixes in a straight line between two stops", () => {
    // Halfway from 3 m to 5 m.
    expect(waveColour(ramp, 4)).toEqual([
      (0x2a + 0x3b) / 2,
      (0x55 + 0x2c) / 2,
      (0xa3 + 0x8e) / 2,
      1,
    ]);
  });

  it("holds the last stop above 8 m, and has none for an unknown height", () => {
    expect(waveColour(ramp, 12)).toEqual(waveColour(ramp, 8));
    expect(waveColour(ramp, NaN)).toBeNull();
    expect(waveColour(ramp, Infinity)).toBeNull();
  });
});

describe("the wave map's picture", () => {
  // Twelve cells by twelve: the sea in the west, land in the east half.
  const grid: Grid = {
    width: 12,
    height: 12,
    west: -12,
    east: -1,
    north: 56,
    south: 45,
    dx: 1,
    dy: 1,
  };
  const heights = new Float32Array(144);
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 12; x++) heights[y * 12 + x] = x < 6 ? 2 : NaN;
  const image = waveImage(grid, heights, ramp, 4);
  const pixel = (x: number, y = Math.floor(image.height / 2)) => [
    ...image.data.slice(
      (y * image.width + x) * 4,
      (y * image.width + x) * 4 + 4,
    ),
  ];

  it("colours the sea, a little see-through", () => {
    // Four and a half cells in: past the picture's feathered edge.
    const sea = pixel(Math.round((image.width * 4.5) / 11));
    expect(sea).toEqual([0x1f, 0x83, 0xa8, Math.round(WAVE_ALPHA * 255)]);
  });

  it("leaves the land clear, the sea ending midway between the cells", () => {
    expect(pixel(Math.round(image.width * 0.75))[3]).toBe(0);
    // The last sea cell is the sixth of twelve, at 5/11 of the way across;
    // the first land cell at 6/11. Their midway is the coast.
    const coast = (5.5 / 11) * image.width;
    expect(pixel(Math.floor(coast) - 2)[3]).toBeGreaterThan(0);
    expect(pixel(Math.ceil(coast) + 1)[3]).toBe(0);
  });

  it("draws nothing where nothing is known", () => {
    const blank = waveImage(grid, new Float32Array(144).fill(NaN), ramp);
    expect(blank.data.every((value) => value === 0)).toBe(true);
  });
});
