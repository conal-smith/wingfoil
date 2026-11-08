// The theme's colour stops of the map's drawn fields, apart from the code
// that draws them: the legend (src/MapScales.tsx) builds its ramps from the
// same stops the map draws with, and is in the page from the first paint,
// while the drawing (force5/src/sky.ts, waveField.ts) is fetched only once a
// field is on. So these few lines are all of it the legend brings in.

/**
 * The sky's colours by total cloud, per cent: the theme's (`--color-sky-*`,
 * ui/theme.css), the same the spot page's sky is drawn in. Between two stops
 * the colour is mixed in a straight line.
 */
export const SKY_STOPS = [
  { cloud: 0, token: "--color-sky-c0" },
  { cloud: 30, token: "--color-sky-c30" },
  { cloud: 55, token: "--color-sky-c55" },
  { cloud: 78, token: "--color-sky-c78" },
  { cloud: 100, token: "--color-sky-c100" },
] as const;
/** The night every sky darkens to, clear or overcast. */
export const SKY_NIGHT = "--map-sky-night";

/**
 * The wave height's colours, in metres: the theme's (`--color-waves-m*`,
 * ui/theme.css), the ones the cards draw an hour's waves in. Between two
 * stops the colour is mixed in a straight line; 8 m and over is the last.
 */
export const WAVE_STOPS = [
  { metres: 0, token: "--color-waves-m0" },
  { metres: 0.5, token: "--color-waves-m05" },
  { metres: 1, token: "--color-waves-m1" },
  { metres: 2, token: "--color-waves-m2" },
  { metres: 3, token: "--color-waves-m3" },
  { metres: 5, token: "--color-waves-m5" },
  { metres: 8, token: "--color-waves-m8" },
] as const;
