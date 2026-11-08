// The map's Waves field: the wave height on the sea at the hour shown, from
// Irish Shelf SWAN's frames (force5/src/waveFrames.ts), coloured as the
// finder's cards colour a wave height. Pure: the colours are read from the
// theme by whoever draws (force5/src/waveLayer.ts) and given, and the legend
// (src/MapScales.tsx) builds its ramp from the same stops.
import { WAVE_STOPS } from "./fieldStops";
import { parseColour } from "./foilDepth";
import { edgeAt, gridLayout, sampleAt, type GridImage } from "./gridImage";
import type { RainRgba } from "./rain";
import type { Grid } from "./weather";

export { WAVE_STOPS };

/**
 * How solid the sea's colour is: nearly, since the height is the field and
 * its steps must read true, but not quite, so the depth tints' banks and the
 * chart's soundings still show faintly through it near the shore.
 */
export const WAVE_ALPHA = 0.85;

/** The wave map at one hour, as the map draws it. */
export interface WaveView {
  /** Changes whenever the picture would: the run and the frame. */
  key: string;
  grid: Grid;
  /** Metres per cell, rows north to south; NaN on land and off the model. */
  heights: Float32Array;
  /** The frame's hour, in UTC milliseconds. */
  time: number;
}

export type WaveRamp = { metres: number; rgba: RainRgba }[];

/** The ramp's colours, read from the theme (or given, in a test). */
export const waveRamp = (read: (token: string) => string): WaveRamp =>
  WAVE_STOPS.map(({ metres, token }) => ({
    metres,
    rgba: parseColour(read(token)) ?? [0, 0, 0, 0],
  }));

/** The colour of a wave height; the last stop's above it, null where unknown. */
export function waveColour(ramp: WaveRamp, metres: number): RainRgba | null {
  if (!Number.isFinite(metres) || !ramp.length) return null;
  const at = ramp.findIndex((stop) => stop.metres >= metres);
  if (at === 0) return ramp[0].rgba;
  if (at < 0) return ramp[ramp.length - 1].rgba;
  const a = ramp[at - 1];
  const b = ramp[at];
  const t = (metres - a.metres) / (b.metres - a.metres);
  return a.rgba.map((v, i) => v + (b.rgba[i] - v) * t) as unknown as RainRgba;
}

/** The table's steps: a centimetre in five is finer than a colour shows. */
const TABLE_STEP_M = 0.05;

/**
 * The Waves field's picture: the heights coloured, on the sea alone, laid out
 * for the map (force5/src/gridImage.ts), `scale` pixels to a cell each way.
 * Between sea cells the height is bilinear; the land and anywhere the model
 * does not reach (NaN) is transparent, the sea ending midway between a wet
 * cell and a dry one, so the coast is not drawn half a cell inland.
 */
export function waveImage(
  grid: Grid,
  heights: Float32Array,
  ramp: WaveRamp,
  scale = 2,
): GridImage {
  const layout = gridLayout(grid, scale);
  const { width, height } = layout;
  const data = new Uint8ClampedArray(width * height * 4);
  const top = ramp.length ? ramp[ramp.length - 1].metres : 0;
  const steps = Math.round(top / TABLE_STEP_M);
  // The ramp read once, a colour every 5 cm up to its last stop.
  const table = Array.from(
    { length: steps + 1 },
    (_, k) => waveColour(ramp, k * TABLE_STEP_M) ?? [0, 0, 0, 0],
  );
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const metres = sampleAt(heights, grid.width, layout, row, col, 0.5);
      if (metres !== metres) continue;
      const [r, g, b, a] =
        table[Math.min(steps, Math.max(0, Math.round(metres / TABLE_STEP_M)))];
      const i = (row * width + col) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = Math.round(a * WAVE_ALPHA * 255 * edgeAt(layout, row, col));
    }
  }
  return { width, height, data, coordinates: layout.coordinates };
}
