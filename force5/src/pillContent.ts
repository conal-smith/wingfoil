/**
 * What a pill on the finder's map says (./lights.ts), by the field the map
 * shows: the map's one field, none, Wind, Waves or Weather, so that the pills
 * read what the map is coloured by.
 *
 * - None: an arrow the way the wind blows, the wind with its unit, and the
 *   sky ("↗ 13 kn" and a cloud).
 * - Wind: the arrow, the wind, and the gust raised beside it.
 * - Waves: an arrow the way the sea runs, its height in metres, and its peak
 *   period raised beside it. A spot the open sea's waves do not reach has no
 *   wave pill.
 * - Weather: the sky beside the air's temperature, and the rain in the hour
 *   raised beside it while it rains.
 *
 * Neutral, whatever it says: the pill is dark with light words and the stars
 * are on the cards, not the map. The arrow alone may be red, for a wind
 * blowing off the shore. Pure: the field, the reading and the units in, the
 * parts out, for lights.ts to draw and for a test to read.
 */
import { skyGlyph, type GlyphDef } from "../../shared/web/glyphSet";
import type { MapField } from "./mapField";
import type { WeatherIcon } from "./presentWeather";
import { speedShort, unitLabel, type Units } from "./units";

/** The map's field: the colour laid over it, or none (./mapField.ts). */
export type PillField = MapField;

/** One spot's reading at the hour the pills stand at. */
export interface PillReading {
  /** Where the wind blows from, in degrees, or null with no reading. */
  from: number | null;
  /** The wind and the gust, in knots, or null. */
  windKn: number | null;
  gustKn: number | null;
  /** The hour is after dark: the moon for the sun. */
  dark: boolean;
  /** The sky's present-weather group, or null where it is not read. */
  sky: WeatherIcon | null;
  /** The air, °C, or null. */
  air: number | null;
  /** The rain in the hour, mm, or null. */
  rain: number | null;
  /** The sea: its height in metres, period in seconds, and where it comes from. */
  sea: {
    height: number;
    period: number | null;
    direction: number | null;
  } | null;
  /** The open sea's waves do not reach the spot (a lake, a lough, a harbour). */
  inland: boolean;
}

/** The parts of a pill, in the order they stand. */
export interface PillParts {
  /** The arrow's turn, in degrees from pointing up, or null for none. */
  arrow: number | null;
  /** The sky's glyph, and where it stands: before the figure or after it. */
  sky: { icon: WeatherIcon; dark: boolean; first: boolean } | null;
  /** The figure the pill is about. */
  figure: string;
  /** Its unit, small, or null. */
  unit: string | null;
  /** A second figure, raised and quieter: the gust, the period, the rain. */
  sup: string | null;
}

/** The rain counted as raining, mm in the hour. */
export const RAINING_MM = 0.1;

/** An arrow pointing the way something goes, from where it comes from. */
const going = (from: number | null) =>
  from === null ? null : Math.round(from + 180) % 360;

/** The sky's glyph: cloud and rain where no group is read but rain is. */
function skyOf(r: PillReading, first: boolean): PillParts["sky"] {
  const raining = (r.rain ?? 0) >= RAINING_MM;
  const icon =
    r.sky && raining && (r.sky === "clear" || r.sky === "partly")
      ? "rain"
      : (r.sky ?? (raining ? "rain" : null));
  return icon ? { icon, dark: r.dark, first } : null;
}

/**
 * A pill's parts for the field, or null for no pill at all: a spot the sea's
 * waves do not reach, with Waves on. A figure not read yet is a dash.
 */
export function pillContent(
  field: PillField,
  r: PillReading,
  units: Units,
): PillParts | null {
  const wind = r.windKn === null ? "–" : speedShort(r.windKn, units);
  if (field === "waves") {
    if (r.inland) return null;
    return {
      arrow: r.sea ? going(r.sea.direction) : null,
      sky: null,
      figure: r.sea ? r.sea.height.toFixed(1) : "–",
      unit: null,
      sup: r.sea?.period == null ? null : `${Math.round(r.sea.period)}s`,
    };
  }
  if (field === "weather") {
    const raining = r.rain !== null && r.rain >= RAINING_MM;
    return {
      arrow: null,
      sky: skyOf(r, true),
      figure: r.air === null ? "–" : `${Math.round(r.air)}°`,
      unit: null,
      sup: raining ? r.rain!.toFixed(1) : null,
    };
  }
  if (field === "wind")
    return {
      arrow: r.windKn === null ? null : going(r.from),
      sky: null,
      figure: wind,
      unit: null,
      sup:
        r.windKn === null || r.gustKn === null
          ? null
          : speedShort(r.gustKn, units),
    };
  return {
    arrow: r.windKn === null ? null : going(r.from),
    sky: skyOf(r, false),
    figure: wind,
    // Force is said with its figure ("F4"), and needs no unit after it.
    unit: units === "bft" || r.windKn === null ? null : unitLabel(units),
    sup: null,
  };
}

/** A pill's parts as one string, to tell when it has changed. */
export const pillKey = (p: PillParts | null) =>
  p === null
    ? ""
    : `${p.arrow ?? ""}|${p.sky ? `${p.sky.icon},${p.sky.dark},${p.sky.first}` : ""}|${p.figure}|${p.unit ?? ""}|${p.sup ?? ""}`;

/** The pill's arrow, pointing up, in a 12-unit box about its centre. */
export const PILL_ARROW = "M0 4.6V-4.4M-2.7 -1.6L0 -4.8L2.7 -1.6";

/** A glyph's part as SVG: its paints as classes, for the stylesheet to colour. */
function glyphPart(part: GlyphDef[number]): string {
  if ("text" in part) return "";
  const cls = [
    part.fill ? `f-${part.fill}` : "",
    part.stroke ? `s-${part.stroke}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const attrs = [
    cls ? ` class="${cls}"` : "",
    part.width ? ` stroke-width="${part.width}"` : "",
    part.dash ? ` stroke-dasharray="${part.dash}"` : "",
    part.opacity !== undefined ? ` opacity="${part.opacity}"` : "",
  ].join("");
  return "d" in part
    ? `<path d="${part.d}"${attrs}/>`
    : `<circle cx="${part.cx}" cy="${part.cy}" r="${part.r}"${attrs}/>`;
}

/**
 * A pill's parts as its markup: the arrow, the figure, its unit, the raised
 * figure and the sky, in the order the field has them. Coloured by the
 * stylesheet (src/map.css), lit or not.
 */
export function pillHtml(p: PillParts | null): string {
  if (!p) return "";
  const sky = p.sky
    ? `<svg class="lt-sky" viewBox="0 0 24 24">${skyGlyph(p.sky.icon, p.sky.dark).map(glyphPart).join("")}</svg>`
    : "";
  const arrow =
    p.arrow === null
      ? ""
      : `<svg class="lt-pa" viewBox="-6 -6 12 12"><g transform="rotate(${p.arrow})"><path d="${PILL_ARROW}"/></g></svg>`;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return [
    p.sky?.first ? sky : "",
    arrow,
    `<b class="lt-kn">${esc(p.figure)}</b>`,
    p.unit ? `<span class="lt-u">${esc(p.unit)}</span>` : "",
    p.sup ? `<sup class="lt-gu">${esc(p.sup)}</sup>` : "",
    p.sky && !p.sky.first ? sky : "",
  ].join("");
}
