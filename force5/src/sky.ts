// The sky: what the map's Weather field lays over the chart. Each cell's
// colour comes from its total cloud and the sun there: the sun's yellow under
// a clear sky, paling through cream to grey under a full cover, all of it
// darkening to night once the sun is down. The rain (force5/src/rain.ts) is
// laid over it in its blues.
//
// The cloud is ICON-EU's, from the same hourly frames as the rain; the sun is
// worked out for each cell at the hour shown (force5/src/sun.ts), so dusk
// crosses the country from east to west as it does. Pure: the colours are
// read from the theme by whoever draws (force5/src/skyLayer.ts) and given.
import { SKY_NIGHT, SKY_STOPS } from "./fieldStops";
import { parseColour } from "./foilDepth";
import { edgeAt, gridLayout, sampleAt, type GridImage } from "./gridImage";
import {
  frameCloud,
  rainColour,
  rainImage,
  rainRamp,
  rainTable,
  rainTableIndex,
  type RainFrame,
  type RainRgba,
} from "./rain";
import { sunElevationAt } from "./sun";
import type { Grid } from "./weather";

export { SKY_NIGHT, SKY_STOPS };

/**
 * How much of the chart under the sky still shows: a little. The sky is the
 * field, so it is nearly solid, but the land's and the sea's own shades come
 * through it faintly, so the coast reads even where its line is thin, and a
 * dark sea is told from a dark land at night.
 */
export const SKY_ALPHA = 0.85;

/**
 * Where night begins and ends, in degrees of the sun's height: full night
 * once it is 6° under the horizon (the end of civil twilight, when the land
 * goes dark), full day once it is 3° over it. Between them the sky darkens
 * smoothly, so a dusk is a band across the map rather than a line.
 */
export const NIGHT_BELOW = -6;
export const DAY_ABOVE = 3;

/** How dark the sky is with the sun at `elevation` degrees: 0 day, 1 night. */
export function darkness(elevation: number): number {
  const t = Math.min(
    1,
    Math.max(0, (elevation - NIGHT_BELOW) / (DAY_ABOVE - NIGHT_BELOW)),
  );
  return 1 - t * t * (3 - 2 * t);
}

export interface SkyPalette {
  /** The cloud's stops, from clear to overcast. */
  cloud: { cloud: number; rgba: RainRgba }[];
  night: RainRgba;
  /** The rain's ramp, laid over the sky. */
  rain: { mmPerHour: number; rgba: RainRgba }[];
}

/** The sky's colours and the rain's, read from the theme (or given, in a test). */
export function skyPalette(read: (token: string) => string): SkyPalette {
  const colour = (token: string): RainRgba =>
    parseColour(read(token)) ?? [0, 0, 0, 0];
  return {
    cloud: SKY_STOPS.map(({ cloud, token }) => ({
      cloud,
      rgba: colour(token),
    })),
    night: colour(SKY_NIGHT),
    rain: rainRamp(read),
  };
}

/** The colour of a cloud cover by day, [r, g, b]; null where it is unknown. */
export function cloudColour(
  stops: SkyPalette["cloud"],
  cloud: number | null,
): [number, number, number] | null {
  if (cloud === null || !Number.isFinite(cloud) || !stops.length) return null;
  const at = stops.findIndex((stop) => stop.cloud >= cloud);
  if (at <= 0) {
    const [r, g, b] = stops[at < 0 ? stops.length - 1 : 0].rgba;
    return [r, g, b];
  }
  const a = stops[at - 1];
  const b = stops[at];
  const t = (cloud - a.cloud) / (b.cloud - a.cloud);
  return [0, 1, 2].map((i) => a.rgba[i] + (b.rgba[i] - a.rgba[i]) * t) as [
    number,
    number,
    number,
  ];
}

/**
 * A colour laid over another, both [r, g, b, a] with a from 0 to 1: the
 * painter's "over". Either may be null, for nothing.
 */
function over(top: RainRgba | null, under: RainRgba | null): RainRgba | null {
  if (!top || top[3] <= 0) return under;
  if (!under || under[3] <= 0) return top;
  const a = top[3] + under[3] * (1 - top[3]);
  const mix = (i: number) =>
    (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a;
  return [mix(0), mix(1), mix(2), a];
}

/**
 * A cell's colour: its cloud's by day, mixed toward the night by `dark`
 * (0 to 1, from `darkness`), see-through by `SKY_ALPHA`; and over it the rain
 * at `mmPerHour`. Nothing where the cloud is unknown and it is dry.
 */
export function skyColour(
  palette: SkyPalette,
  cloud: number | null,
  dark: number,
  mmPerHour: number,
): RainRgba | null {
  const day = cloudColour(palette.cloud, cloud);
  const sky: RainRgba | null = day && [
    day[0] + (palette.night[0] - day[0]) * dark,
    day[1] + (palette.night[1] - day[1]) * dark,
    day[2] + (palette.night[2] - day[2]) * dark,
    SKY_ALPHA,
  ];
  return over(rainColour(palette.rain, mmPerHour), sky);
}

/**
 * The mean total cloud of some frames, per cell in per cent, NaN where any
 * of them does not know it; null when any frame carries none (a run from
 * before the frames carried the cloud, or a frame whose cloud is malformed),
 * and then the map draws the rain alone.
 */
export function meanCloud(
  frames: readonly Pick<RainFrame, "clct">[],
  grid: Pick<Grid, "width" | "height">,
): Float32Array | null {
  const clouds = frames.map((frame) => frameCloud(frame, grid));
  if (!clouds.length || clouds.some((cloud) => !cloud)) return null;
  const count = grid.width * grid.height;
  const mean = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let total = 0;
    for (const cloud of clouds) {
      const value = cloud![i];
      if (value === null) {
        total = NaN;
        break;
      }
      total += value;
    }
    mean[i] = total / clouds.length;
  }
  return mean;
}

/** How dark each cell's sky is at `time`, rows north to south. */
export function gridDarkness(grid: Grid, time: number): Float32Array {
  const elevation = sunElevationAt(time);
  const dark = new Float32Array(grid.width * grid.height);
  for (let y = 0; y < grid.height; y++) {
    const lat = grid.north - y * grid.dy;
    for (let x = 0; x < grid.width; x++)
      dark[y * grid.width + x] = darkness(
        elevation(lat, grid.west + x * grid.dx),
      );
  }
  return dark;
}

/**
 * The Weather field's picture: the sky of every cell from its cloud and its
 * sun at `time`, and the rain over it, laid out as the rain's own picture is
 * (force5/src/gridImage.ts), `scale` pixels to a cell each way. The sun is
 * worked out once a cell and its darkness sampled between cells as the cloud
 * and the rain are, which is smooth enough for a dusk some hundreds of
 * kilometres wide. Where the cloud is unknown only the rain is drawn; with no
 * cloud at all (`cloud` null), the picture is the rain's alone.
 */
export function skyImage(
  grid: Grid,
  cloud: Float32Array | null,
  rates: Float32Array,
  time: number,
  palette: SkyPalette,
  scale = 2,
): GridImage {
  if (!cloud) return rainImage(grid, rates, palette.rain, scale);
  const layout = gridLayout(grid, scale);
  const { width, height } = layout;
  const data = new Uint8ClampedArray(width * height * 4);
  const dark = gridDarkness(grid, time);
  // The cloud's colours by day at each whole per cent, read once: the frames
  // carry it to the nearest 5, and a mean of a few of them is no finer.
  const day = Array.from({ length: 101 }, (_, k) =>
    cloudColour(palette.cloud, k),
  );
  const rain = rainTable(palette.rain);
  const night = palette.night;
  const w = grid.width;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const edge = edgeAt(layout, row, col);
      if (!edge) continue;
      const at = rainTableIndex(sampleAt(rates, w, layout, row, col)) * 4;
      const c = sampleAt(cloud, w, layout, row, col);
      const ra = at < 0 ? 0 : rain[at + 3] / 255;
      if (c !== c && !ra) continue;
      // The sky, then the rain over it, as `skyColour` mixes them; where the
      // cloud is unknown, the rain alone.
      const base =
        c === c ? day[Math.round(Math.min(100, Math.max(0, c)))]! : null;
      const d = base ? sampleAt(dark, w, layout, row, col) : 0;
      const sa = base ? SKY_ALPHA * (1 - ra) : 0;
      const a = ra + sa;
      const i = (row * width + col) * 4;
      for (let k = 0; k < 3; k++)
        data[i + k] =
          ((ra && ra * rain[at + k]) +
            (base ? sa * (base[k] + (night[k] - base[k]) * d) : 0)) /
          a;
      data[i + 3] = Math.round(a * 255 * edge);
    }
  }
  return { width, height, data, coordinates: layout.coordinates };
}
