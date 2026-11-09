import { PALETTE, windColor } from "../force5/src/weather";
import { FEET_PER_METRE, type WaveUnits } from "../force5/src/units";
import type { MapField } from "../force5/src/mapField";
import { RAIN_STOPS } from "../force5/src/rain";
// The stops alone, not the drawing: that is fetched once a field is on.
import { SKY_NIGHT, SKY_STOPS, WAVE_STOPS } from "../force5/src/fieldStops";

/** A ramp's colours, and the words under it, evenly spaced. */
interface Ramp {
  /** What the figures are, before the ramp. */
  unit: string;
  /** The ramp's colours, as a gradient's stops. */
  stops: string;
  /** A few figures under it, spread evenly from end to end. */
  marks: readonly string[];
}

/** A field's legend: a ramp or two, and the whole of it in words. */
interface Legend {
  ramps: readonly Ramp[];
  /** The legend as words, for a screen reader. */
  spoken: string;
}

const percent = (t: number) => `${(t * 100).toFixed(1)}%`;

/** The wind's ramp from calm to 40 kn, generated from PALETTE stop for stop. */
const WIND_TOP = 40;
const windStops = () =>
  [...PALETTE.map(([kn]) => kn).filter((kn) => kn < WIND_TOP), WIND_TOP]
    .map((kn) => `rgb(${windColor(kn).join(" ")}) ${percent(kn / WIND_TOP)}`)
    .join(", ");

/**
 * The wave height's ramp, from the stops the map draws with
 * (force5/src/fieldStops.ts), placed so that each mark stands over its own
 * height: the marks evenly spaced, and the stops between two marks in a
 * straight line between them, as the map mixes them. The stops past the last
 * mark are its "and over".
 */
const WAVE_MARKS = [0, 1, 2, 3, 5] as const;
const waveStops = () => {
  const last = WAVE_MARKS[WAVE_MARKS.length - 1];
  const place = (metres: number) => {
    const k = WAVE_MARKS.findIndex((mark) => mark >= metres);
    if (k <= 0) return 0;
    const a = WAVE_MARKS[k - 1];
    const t = (metres - a) / (WAVE_MARKS[k] - a);
    return (k - 1 + t) / (WAVE_MARKS.length - 1);
  };
  return WAVE_STOPS.filter(({ metres }) => metres <= last)
    .map(({ metres, token }) => `var(${token}) ${percent(place(metres))}`)
    .join(", ");
};

/**
 * The sky's ramp, from the stops the map draws with
 * (force5/src/fieldStops.ts): the night at its start, then the day's sky from
 * a full cover to a clear one. The night holds the first part, under its
 * mark, then lightens into the grey, as a dusk does on the map.
 */
const NIGHT_UNTIL = 0.1;
const CLOUD_FROM = 0.4;
const skyStops = () =>
  [
    `var(${SKY_NIGHT}) 0%`,
    `var(${SKY_NIGHT}) ${percent(NIGHT_UNTIL)}`,
    ...[...SKY_STOPS]
      .reverse()
      .map(
        ({ cloud, token }) =>
          `var(${token}) ${percent(CLOUD_FROM + (1 - CLOUD_FROM) * (1 - cloud / 100))}`,
      ),
  ].join(", ");

/** The rain's ramp, its stops evenly spaced (force5/src/rain.ts). */
const rainStops = () =>
  RAIN_STOPS.map(
    ({ token }, i) => `var(${token}) ${percent(i / (RAIN_STOPS.length - 1))}`,
  ).join(", ");

const LEGENDS: Record<
  Exclude<MapField, "none">,
  (waveUnits: WaveUnits) => Legend
> = {
  wind: () => ({
    ramps: [
      {
        unit: "Knots",
        stops: windStops(),
        marks: ["0", "10", "20", "30", "40"],
      },
    ],
    spoken:
      "Wind in knots: blue under 10, green 10 to 20, yellow by 30, red by 40",
  }),
  // The wave height's own ramp, the one the finder's cards draw.
  waves: (waveUnits) => {
    const feet = waveUnits === "ft";
    const marks = WAVE_MARKS.map((m) =>
      feet ? Math.round(m * FEET_PER_METRE) : m,
    );
    return {
      ramps: [
        {
          unit: feet ? "Feet" : "Metres",
          stops: waveStops(),
          marks: marks.map((m, i) =>
            i === marks.length - 1 ? `${m}+` : `${m}`,
          ),
        },
      ],
      spoken: `Wave height in ${feet ? "feet" : "metres"}: faint at 0, stronger through ${marks[1]}, ${marks[2]} and ${marks[3]}, strongest at ${marks[4]} and over`,
    };
  },
  // The sky by its cloud and the sun, and the rain an hour laid over it.
  weather: () => ({
    ramps: [
      { unit: "Sky", stops: skyStops(), marks: ["Night", "Cloud", "Clear"] },
      { unit: "Rain", stops: rainStops(), marks: ["0.1", "8+ mm/h"] },
    ],
    spoken:
      "Sky: black at night, grey under cloud, yellow where it is clear. Rain over it in blues, faint at 0.1 millimetres an hour, strong at 8 and over",
  }),
};

/** One ramp: its unit before it, the bar, and its marks under it. */
function RampBar({ ramp }: { ramp: Ramp }) {
  return (
    <>
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
    </>
  );
}

/**
 * The map's legend, at the right of its dock (src/MapDock.tsx): what the
 * colour on the map means just now. With no field on, the shallows' glow, as
 * a swatch and its name; with one, its ramp (the sky and the rain beside it,
 * for Weather), each with its unit before it and a few figures under it,
 * evenly spaced so that none touches the next, the first and last held inside
 * its ends. With a `note`, the field draws nothing at this hour and the note
 * says why ("Sky map to Wed"), quietly, in the ramp's place. Never a source's
 * name: that is in About the map. A ramp is generated from the colours the
 * map draws with, never restated.
 */
export default function MapScales({
  field,
  note = null,
  waveUnits = "ft",
}: {
  field: MapField;
  note?: string | null;
  waveUnits?: WaveUnits;
}) {
  if (field === "none")
    return (
      <p className="map-legend" data-map-legend="none">
        <i className="ml-swatch" aria-hidden="true" />
        Shallow water
      </p>
    );
  if (note)
    return (
      <p className="map-legend" data-map-legend={field} data-map-legend-note>
        {note}
      </p>
    );
  const legend = LEGENDS[field](waveUnits);
  return (
    <figure
      className="map-legend"
      data-map-legend={field}
      aria-label={legend.spoken}
    >
      {legend.ramps.map((ramp) => (
        <RampBar key={ramp.unit} ramp={ramp} />
      ))}
    </figure>
  );
}
