import { RAIN_KEY_MM } from "../force5/src/rain";
import { FEET_PER_METRE, type WaveUnits } from "../force5/src/units";
import { SKY_NIGHT, SKY_STOPS, WAVE_STOPS } from "../force5/src/fieldStops";

/**
 * The fields' keys in About the map: a swatch a step, each in the colour the
 * map draws it, on the chart's own sea, its figure under it and its unit
 * after the row. The rain's, the sky's and the waves' share the look
 * (`.rain-scale`, src/map.css).
 */
function SwatchScale({
  label,
  unit,
  steps,
  ...data
}: {
  label: string;
  unit: string;
  steps: readonly { colour: string; figure: string }[];
} & Record<`data-${string}`, boolean>) {
  return (
    <figure className="rain-scale" aria-label={label} {...data}>
      <ol aria-hidden="true">
        {steps.map(({ colour, figure }) => (
          <li key={figure}>
            <span style={{ background: colour }} />
            <small>{figure}</small>
          </li>
        ))}
      </ol>
      <i aria-hidden="true">{unit}</i>
    </figure>
  );
}

/**
 * Each amount's colour, as the field paints it (force5/src/rain.ts): the
 * theme's four stops, and 1 and 4 mm halfway between their neighbours, which
 * on the rain's logarithmic ramp they are.
 */
const SWATCH: Record<(typeof RAIN_KEY_MM)[number], string> = {
  0.1: "var(--map-rain-drizzle)",
  0.5: "var(--map-rain-light)",
  1: "color-mix(in srgb, var(--map-rain-light), var(--map-rain-moderate))",
  2: "var(--map-rain-moderate)",
  4: "color-mix(in srgb, var(--map-rain-moderate), var(--map-rain-heavy))",
  8: "var(--map-rain-heavy)",
};

/**
 * The rain's key: the rain in an hour, from drizzle to heavy, each in the
 * colour the map lays over the sky. Dry is nothing at all, so it has no
 * swatch.
 */
export function RainScale() {
  return (
    <SwatchScale
      data-rain-key
      label="Rain scale, millimetres in the hour: faint blue at 0.1, deepening through 0.5, 1, 2 and 4, strong at 8 and over; nothing where it is dry"
      unit="mm/h"
      steps={RAIN_KEY_MM.map((mm) => ({
        colour: SWATCH[mm],
        figure: `${mm}${mm === 8 ? "+" : ""}`,
      }))}
    />
  );
}

/**
 * A colour as the map lays it, a little see-through (force5/src/sky.ts and
 * waveField.ts draw at 85 %), so the swatch shows the chart's sea under it as
 * the map does.
 */
const laid = (token: string) =>
  `color-mix(in srgb, var(${token}) 85%, transparent)`;

/**
 * The sky's key: its colour by day at each of the theme's stops of cloud, from
 * clear to overcast, and the night every sky darkens to.
 */
export function SkyScale() {
  return (
    <SwatchScale
      data-sky-key
      label="Sky scale, per cent of cloud by day: yellow at 0, paling through 30, 55 and 78 to grey at 100; black at night whatever the cloud"
      unit="% cloud"
      steps={[
        ...SKY_STOPS.map(({ cloud, token }) => ({
          colour: laid(token),
          figure: `${cloud}`,
        })),
        { colour: laid(SKY_NIGHT), figure: "Night" },
      ]}
    />
  );
}

/** The waves' key: the wave height at each of the theme's stops, in metres. */
export function WaveScale({ units = "ft" }: { units?: WaveUnits }) {
  const said = (metres: number) =>
    units === "ft" ? Math.round(metres * FEET_PER_METRE) : metres;
  const heights = WAVE_STOPS.map(({ metres }) => said(metres));
  const last = heights[heights.length - 1];
  return (
    <SwatchScale
      data-wave-key
      label={`Wave height scale, ${units === "ft" ? "feet" : "metres"}: faint at 0, stronger through ${heights.slice(1, -1).join(", ")}, strongest at ${last} and over`}
      unit={units}
      steps={WAVE_STOPS.map(({ metres, token }) => ({
        colour: laid(token),
        figure: `${said(metres)}${said(metres) === last ? "+" : ""}`,
      }))}
    />
  );
}
