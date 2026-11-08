import { PALETTE, windColor } from "../force5/src/weather";
import type { MapField } from "../force5/src/mapField";

/** A ramp's colours at even steps, and the words under it, evenly spaced. */
interface Ramp {
  /** What the figures are, before the ramp. */
  unit: string;
  /** The ramp's colours, as a gradient's stops. */
  stops: string;
  /** A few figures under it, spread evenly from end to end. */
  marks: readonly string[];
  /** The legend as words, for a screen reader. */
  spoken: string;
}

/** The wind's ramp from calm to 40 kn, generated from PALETTE stop for stop. */
const WIND_TOP = 40;
const windStops = () =>
  [...PALETTE.map(([kn]) => kn).filter((kn) => kn < WIND_TOP), WIND_TOP]
    .map(
      (kn) =>
        `rgb(${windColor(kn).join(" ")}) ${((kn / WIND_TOP) * 100).toFixed(1)}%`,
    )
    .join(", ");

const even = (colours: readonly string[]) =>
  colours
    .map((c, i) => `${c} ${((i / (colours.length - 1)) * 100).toFixed(1)}%`)
    .join(", ");

const RAMPS: Record<Exclude<MapField, "none">, () => Ramp> = {
  wind: () => ({
    unit: "Knots",
    stops: windStops(),
    marks: ["0", "10", "20", "30", "40"],
    spoken:
      "Wind in knots: blue under 10, green 10 to 20, yellow by 30, red by 40",
  }),
  // The wave height's own ramp (ui/theme.css, `--map-wave-*`), a stop a mark.
  waves: () => ({
    unit: "Metres",
    stops: even([0, 1, 2, 3, 5].map((m) => `var(--map-wave-${m})`)),
    marks: ["0", "1", "2", "3", "5+"],
    spoken: "Wave height in metres: 0, 1, 2, 3, and 5 and over",
  }),
  // The rain an hour, as the Rain field lays it over the chart
  // (force5/src/rain.ts), until the sky is drawn under it.
  weather: () => ({
    unit: "Rain mm/h",
    stops: even([
      "var(--map-rain-drizzle)",
      "var(--map-rain-light)",
      "var(--map-rain-moderate)",
      "var(--map-rain-heavy)",
    ]),
    marks: ["0.1", "0.5", "2", "8+"],
    spoken:
      "Rain in millimetres an hour: faint at 0.1, deepening through 0.5 and 2, strong at 8 and over",
  }),
};

/**
 * The map's legend, at the right of its dock (src/MapDock.tsx): what the
 * colour on the map means just now. With no field on, the shallows' glow, as
 * a swatch and its name; with one, its ramp, its unit before it and a few
 * figures under it, evenly spaced so that none touches the next, the first
 * and last held inside its ends. Never a source's name: that is in About the
 * map. A ramp is generated from the colours the map draws with, never
 * restated.
 */
export default function MapScales({ field }: { field: MapField }) {
  if (field === "none")
    return (
      <p className="map-legend" data-map-legend="none">
        <i className="ml-swatch" aria-hidden="true" />
        Shallow water
      </p>
    );
  const ramp = RAMPS[field]();
  return (
    <figure
      className="map-legend"
      data-map-legend={field}
      aria-label={ramp.spoken}
    >
      <span className="ml-unit" aria-hidden="true">
        {ramp.unit}
      </span>
      <span className="ml-ramp" aria-hidden="true">
        <span
          className="ml-bar"
          style={{ background: `linear-gradient(90deg, ${ramp.stops})` }}
        />
        <span className="ml-marks">
          {ramp.marks.map((mark, i) => (
            <span
              key={mark}
              style={{ left: `${(i / (ramp.marks.length - 1)) * 100}%` }}
            >
              {mark}
            </span>
          ))}
        </span>
      </span>
    </figure>
  );
}
