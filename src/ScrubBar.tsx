/**
 * The chart's foot: a slim card the full width of the map that moves the
 * chart's time. The data alone (the owner's ruling of 2026-11-02): no name,
 * no buttons. On top, the moment in hand read out in cells that keep their
 * places as the time moves (the time, the wind, the stars, the waves, the
 * tide); under them the strip, the whole forecast from now on along the full
 * width, with a playhead a finger or a mouse drags smoothly through it.
 *
 * With a spot chosen the strip draws its week: the wind (a solid fill in the
 * map's own wind colours on a scale from calm, the gusts dashed over it),
 * under it one row of the stars as colour, the stars' own shades from one to
 * five, and under that a lane each for the waves and the tide. Each band is
 * named in a column of its own beside the hours, and the wind's scale stands
 * there too. With none chosen it is a timeline with one lane, how many spots
 * have stars at each hour, so the bar says where in the week to look before
 * a spot is chosen; the playhead still moves the map. The spot's name is
 * beside it on the map; a tap off it on the map lets it go, and the card with
 * it.
 *
 * The strip is the shared strip of hours (src/TimeStrip.tsx): about eight
 * hours across a phone and a day or so across a desk's screen, never a week
 * squeezed in, a notch for every hour, every third hour's figure and the
 * day's name where a day begins. A finger drags the whole forecast under a
 * playhead that stands still in the middle, one to one and on with the
 * platform's own momentum, and it comes to rest on one of the forecast's
 * hours: the one the map draws. A mouse drags it too, a wheel or a trackpad
 * turns it, and a tap or a click on an hour glides there. The keys step whole
 * hours (Left and Right) and days (with Shift, or Page Up and Page Down).
 *
 * With the hours after dark hidden (Settings, shared/web/afterDark.ts) the
 * strip is the days' lit hours alone, from first light to last, the days
 * side by side with the line between them: the strip, the keys and a wheel
 * move from one day's last light straight to the next one's first.
 */
import {
  startTransition,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Layers3 } from "lucide-react";
import { StarGlyphs } from "../ui/StarGlyphs";
import { WindArrow } from "./glyphs";
import { arrowsFree, hourStep } from "./hourKeys";
import { daylightOn, type PlaceHour } from "./ratings";
import { afterDark, fold, keptShares } from "../shared/web/afterDark";
import {
  clock,
  dayShort,
  dayStep,
  irishDate,
  nearestColumn,
  shownAt,
  shownColumns,
  stripDays,
  timeSpoken,
  type StripColumn,
} from "./strip";
import TimeStrip, { type StripGeometry } from "./TimeStrip";
import { useSpotSquares } from "./useSpotSquares";
import { useSpotWaves } from "./useBlend";
import type { ModelAvailability } from "../force5/src/manifests";
import type { NightHours } from "../force5/src/prefs";
import { spotSquare } from "../force5/src/spotData";
import { tideAt, type SpotTide } from "../force5/src/tides";
import {
  speedShort,
  unitLabel,
  waveText,
  type Units,
  type WaveUnits,
} from "../force5/src/units";
import { variableValue } from "../force5/src/variables";
import { compass, windCss, type Spot } from "../force5/src/weather";
import {
  measuredAt,
  measuredNow,
  pairedName,
  readingAt,
  type MeasuredReading,
  type Paired,
} from "../force5/src/windObs";

/** The night and the days with no spot chosen: the middle of Ireland's. */
const IRELAND_MIDDLE = { lat: 53.4, lon: -7.9 };

const HOUR = 3600000;
const NO_MODELS: readonly ModelAvailability[] = [];

/**
 * The strip's drawing, in pixels: the wind's curve, then the row of stars,
 * then a lane each for the waves and the tide. The curve is the bar's reason
 * for being, so it takes the room: a phone's is shorter, the map being the
 * smaller there.
 */
const CURVE_TOP = 4;
const CURVE_TALL = 64;
const CURVE_SHORT = 48;
/** Below this strip width the curve is the short one. */
const NARROW = 420;
const STARS_GAP = 5;
const STARS_H = 7;
const LANE_H = 14;
const LANE_GAP = 6;
/** With no spot: the days, the night and the lane of spots with stars. */
const BARE_HEIGHT = 24;
/** What the bare strip keeps under its drawing, over the notches. */
const BARE_FOOT = 2;

/** A lane under the wind: what it draws, and where it stands. */
interface Lane {
  kind: "waves" | "tide";
  top: number;
  bottom: number;
}

/** One stretch of hours with a star or more, and the stars of each. */
interface StarRun {
  from: number;
  to: number;
  stops: { at: number; stars: number }[];
}

/** How many spots have stars at one column, and the most any of them has. */
export interface ColumnSpots {
  spots: number;
  best: number;
}

export interface ScrubBarProps {
  /**
   * With no spot chosen: how many of the places rated have stars at each of
   * the strip's columns, and how many places that is out of.
   */
  rated?: { columns: readonly ColumnSpots[]; of: number } | null;
  /**
   * The weather station or buoy beside the place (force5/src/windObs.ts
   * `pairStation`), or null: with the playhead at or before now, the
   * readout says what it measured.
   */
  measured?: Paired | null;
  columns: readonly StripColumn[];
  /** The column in hand, on the strip. */
  selected: number;
  onSelect: (at: number) => void;
  now: number;
  /** The spot or point chosen, or null: then a plain timeline. */
  spot: Spot | null;
  /** The spot is a point tapped on the map: no stars, no page of its own. */
  isPoint: boolean;
  /** The place's hours on the strip's columns, undefined while they are read. */
  hours: readonly (PlaceHour | undefined)[] | undefined;
  /** The tide at the place, where a station reaches it. */
  tide: SpotTide | null;
  /** The wave models, read once the waves are asked for. */
  marine: readonly ModelAvailability[];
  onWantMarine: () => void;
  /** Whose waves a point reads: a riding place near it, or none. */
  lender: Spot | null;
  units: Units;
  waveUnits: WaveUnits;
  nightHours: NightHours;
  /**
   * The spot's page, at the hour in hand; null where there is none. On the
   * screen the way there is the spot's name on the map; this is the keys'.
   */
  href: string | null;
  /** A model that reaches the hour the map's own does not, and its chip. */
  reachable: { id: string; name: string } | null;
  onShowOnMap: () => void;
}

export default function ScrubBar({
  columns: strip,
  selected: stripSelected,
  onSelect: onSelectStrip,
  now,
  spot,
  isPoint,
  hours: stripHours,
  tide,
  marine,
  onWantMarine,
  lender,
  units,
  waveUnits,
  nightHours,
  href,
  reachable,
  onShowOnMap,
  measured = null,
  rated = null,
}: ScrubBarProps) {
  const id = useId();
  const place = spot ?? IRELAND_MIDDLE;
  const stripAxis = useMemo(() => strip.map((c) => c.validTime), [strip]);

  // The hours after dark, from last light to first, left out where the
  // rider has hidden them (Settings, shared/web/afterDark.ts): the strip
  // draws the lit columns alone, each day from its first light to its last
  // and the days joined side by side, and the time stops on those alone.
  // Round the clock, as by default, every column is one to stop on.
  const hideNight = nightHours === "hide";
  const hidden = useMemo(
    () =>
      hideNight
        ? afterDark(
            place,
            strip.map((c) => c.time),
          )
        : null,
    [hideNight, place.lat, place.lon, strip],
  );
  const shown = useMemo(
    () => (hidden ? shownColumns(hidden.map((dark) => !dark)) : null),
    [hidden],
  );
  const stops = useMemo(
    () => (shown ? shown.map((at) => strip[at]) : strip),
    [shown, strip],
  );
  const stopDays = useMemo(() => stripDays(stops), [stops]);
  const selected = shown ? shownAt(shown, stripSelected) : stripSelected;
  const onSelect = (at: number) =>
    onSelectStrip(shown ? (shown[at] ?? stripSelected) : at);
  // A time in the hidden night moves on to the next first light, so the
  // playhead and the map's hour agree.
  useEffect(() => {
    if (
      shown &&
      shown[selected] !== undefined &&
      shown[selected] !== stripSelected
    )
      onSelectStrip(shown[selected]);
  }, [shown, selected, stripSelected]);

  // The strip's own timeline where the night is hidden: the forecast's
  // time with the night taken out, the days joined side by side. Round the
  // clock the strip's time is the clock's.
  const line = useMemo(
    () =>
      shown && hidden
        ? fold(
            keptShares(
              strip.map((c) => c.time),
              hidden,
            ),
          )
        : undefined,
    [shown, hidden, strip],
  );
  const column = strip[stripSelected];
  /** The times the strip comes to rest on: the columns shown. */
  const stopTimes = useMemo(() => stops.map((c) => c.time), [stops]);

  /* ---- the playhead: the time under it, on every frame the strip moves ---- */

  const [pos, setPos] = useState(() => column?.time ?? now);
  const shownRef = useRef({ shown, onSelectStrip });
  shownRef.current = { shown, onSelectStrip };
  /**
   * The strip has come to another stop: the map's hour. Not urgent: the
   * strip moves on its own, and the page draws the hour once it can.
   */
  const pick = useCallback((at: number) => {
    const { shown, onSelectStrip } = shownRef.current;
    const to = shown ? shown[at] : at;
    if (to !== undefined) startTransition(() => onSelectStrip(to));
  }, []);

  /* ---- the strip's size ---- */

  const track = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const read = () => setWidth(el.clientWidth);
    read();
    const watch = new ResizeObserver(read);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  // Left and Right step the hour wherever the focus is, unless it is in a
  // control whose own keys they are (src/hourKeys.ts); with Shift, a day.
  // A page over the map leaves the bar mounted but inert, and its keys alone.
  const bar = useRef<HTMLDivElement>(null);
  const keyed = useRef({
    selected,
    count: stops.length,
    onSelect,
    stops,
    stopDays,
  });
  keyed.current = { selected, count: stops.length, onSelect, stops, stopDays };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const shift =
        event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        (event.key === "ArrowRight" || event.key === "ArrowLeft");
      const step = hourStep(event);
      if ((!step && !shift) || event.defaultPrevented) return;
      if (!arrowsFree(event.target)) return;
      if (bar.current?.closest("[inert]")) return;
      if (document.querySelector("dialog[open]")) return;
      event.preventDefault();
      const { selected, count, onSelect, stops, stopDays } = keyed.current;
      const next = shift
        ? dayStep(
            stops,
            stopDays,
            selected,
            event.key === "ArrowRight" ? 1 : -1,
          )
        : Math.max(0, Math.min(count - 1, selected + step));
      if (next === selected) return;
      keyed.current.selected = next;
      onSelect(next);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  /* ---- what the strip draws ---- */

  const named = !!spot;
  // The waves are read once a place is chosen: the wave manifests are large,
  // and a plain timeline has no use for them.
  useEffect(() => {
    if (named && lender) onWantMarine();
  }, [named, !!lender]);
  const square = useMemo(
    () => (lender ? [spotSquare(lender.lat, lender.lon)] : null),
    [lender?.lat, lender?.lon],
  );
  const waveModels = useSpotSquares(named ? marine : NO_MODELS, square);
  const waves = useSpotWaves(waveModels, lender?.id, stripAxis);

  const daylight = useMemo(
    () => daylightOn(place, stripAxis),
    [place.lat, place.lon, stripAxis],
  );

  /** Each column's wind and gust, wave height and tide. */
  const series = useMemo(() => {
    if (!named) return null;
    const height = waves.source?.fields.total.height;
    return strip.map((c, at) => {
      const step = waves.columns[at];
      return {
        wind: stripHours?.[at]?.windKn ?? null,
        gust: stripHours?.[at]?.gustKn ?? null,
        waves: height && step ? variableValue(step, height) : null,
        tide: tide ? tideAt(tide.curve, c.time) : null,
      };
    });
  }, [named, strip, stripHours, waves, tide]);

  /**
   * The wind's scale: from calm to just over the strongest gust in the
   * forecast, the same wherever the strip is scrolled, so the curve never
   * stretches under the rider's finger.
   */
  const windHigh = useMemo(() => {
    const seen = (series ?? []).flatMap((s) =>
      [s.wind, s.gust].filter((v): v is number => v !== null),
    );
    return Math.max(25, ...seen) * 1.08;
  }, [series]);
  const curveBottom = width && width < NARROW ? CURVE_SHORT : CURVE_TALL;
  const starsY = curveBottom + STARS_GAP;
  const y = useCallback(
    (value: number) =>
      curveBottom - (value / windHigh) * (curveBottom - CURVE_TOP),
    [curveBottom, windHigh],
  );
  /** The scale beside the curve: a line and a figure, ten knots apart or twenty. */
  const windTicks = useMemo(() => {
    const step = windHigh > 45 ? 20 : 10;
    const out: number[] = [];
    // None so near the top that it runs into the band's name.
    for (let kn = step; y(kn) > CURVE_TOP + 16; kn += step) out.push(kn);
    return out;
  }, [windHigh, y]);

  // The lanes under the wind: the waves where a riding place lends them,
  // the tide where a station reaches the place. Each is there from the
  // moment the place is chosen, read or not, so the card never grows under
  // the rider's thumb.
  const lanes = useMemo<Lane[]>(() => {
    if (!named) return [];
    const kinds: Lane["kind"][] = [
      ...(lender ? (["waves"] as const) : []),
      ...(tide ? (["tide"] as const) : []),
    ];
    let top = (isPoint ? curveBottom : starsY + STARS_H) + LANE_GAP;
    return kinds.map((kind) => {
      const lane = { kind, top, bottom: top + LANE_H };
      top += LANE_H + LANE_GAP;
      return lane;
    });
  }, [named, !!lender, !!tide, isPoint, curveBottom]);
  const height = !named
    ? BARE_HEIGHT
    : (lanes.at(-1)?.bottom ?? (isPoint ? curveBottom : starsY + STARS_H)) + 2;
  /** Where the bare strip's drawing ends. */
  const bareBottom = BARE_HEIGHT - BARE_FOOT;
  /** The bare strip's bars: each column's share of the most spots at any hour. */
  const spotBars = useMemo(() => {
    if (named || !rated) return [];
    const most = Math.max(1, ...rated.columns.map((c) => c.spots));
    return rated.columns.flatMap((c, at) => {
      if (!c.spots || hidden?.[at] || !strip[at]) return [];
      const before =
        at > 0 ? (strip[at - 1].time + strip[at].time) / 2 : strip[at].time;
      const after =
        at < strip.length - 1
          ? (strip[at + 1].time + strip[at].time) / 2
          : strip[at].time;
      return [
        {
          at,
          from: before,
          to: after,
          height: Math.max(2, (c.spots / most) * (bareBottom - 2)),
          best: Math.min(5, Math.max(1, c.best)),
        },
      ];
    });
  }, [named, rated, strip, hidden, bareBottom]);
  /** A lane's own scale: the waves from flat, the tide from its lowest. */
  const laneY = useMemo(() => {
    const out = new Map<Lane["kind"], (v: number) => number>();
    for (const lane of lanes) {
      const values = (series ?? [])
        .map((s) => s[lane.kind])
        .filter((v): v is number => v !== null);
      const tidal = lane.kind === "tide";
      const low = tidal && values.length ? Math.min(...values) : 0;
      const high = Math.max(low + (tidal ? 1 : 1.5), ...values);
      out.set(
        lane.kind,
        (v) => lane.bottom - ((v - low) / (high - low)) * (LANE_H - 2),
      );
    }
    return out;
  }, [lanes, series]);

  const starRuns = useMemo<StarRun[]>(() => {
    if (!named || isPoint || !stripHours) return [];
    const runs: StarRun[] = [];
    let run: StarRun | null = null;
    strip.forEach((c, at) => {
      const stars = starsOf(stripHours[at]);
      if (stars >= 1) {
        // Each column's share of the strip: halfway to its neighbours.
        const before = at > 0 ? (strip[at - 1].time + c.time) / 2 : c.time;
        const after =
          at < strip.length - 1 ? (strip[at + 1].time + c.time) / 2 : c.time;
        if (!run) run = { from: before, to: after, stops: [] };
        run.to = after;
        run.stops.push({ at: c.time, stars });
      } else if (run) {
        runs.push(run);
        run = null;
      }
    });
    if (run) runs.push(run);
    return runs;
  }, [named, isPoint, strip, stripHours]);

  /**
   * The night's stretches, each from its first dark column to its last. None
   * with the hours after dark hidden: what is left of the dark is the
   * twilight, drawn as the day is, so nothing on the strip reads as night.
   */
  const nights = useMemo(() => {
    const out: { from: number; to: number }[] = [];
    if (hideNight) return out;
    strip.forEach((c, at) => {
      if (daylight[at]) return;
      const before = at > 0 ? (strip[at - 1].time + c.time) / 2 : c.time;
      const after =
        at < strip.length - 1 ? (strip[at + 1].time + c.time) / 2 : c.time;
      const last = out[out.length - 1];
      if (last && Math.abs(last.to - before) < 1) last.to = after;
      else out.push({ from: before, to: after });
    });
    return out;
  }, [strip, daylight, hideNight]);

  const days = useMemo(() => stripDays(strip), [strip]);

  /**
   * The drawing that scrolls with the hours: the whole forecast, drawn once
   * for the strip's size and the place's hours, never as the strip moves.
   */
  const draw = useCallback(
    (g: StripGeometry) => (
      <StripDrawing
        g={g}
        id={id}
        strip={strip}
        series={series}
        hidden={hidden}
        named={named}
        isPoint={isPoint}
        height={height}
        bareBottom={bareBottom}
        curveBottom={curveBottom}
        starsY={starsY}
        y={y}
        windTicks={windTicks}
        lanes={lanes}
        laneY={laneY}
        starRuns={starRuns}
        spotBars={spotBars}
        nights={nights}
        days={days}
        now={now}
      />
    ),
    [
      id,
      strip,
      series,
      hidden,
      named,
      isPoint,
      height,
      bareBottom,
      curveBottom,
      starsY,
      y,
      windTicks,
      lanes,
      laneY,
      starRuns,
      spotBars,
      nights,
      days,
      now,
    ],
  );

  /* ---- the moment the playhead is at ---- */

  const reading = useMemo(() => {
    if (!series) return null;
    const after = strip.findIndex((c) => c.time >= pos);
    const b = after < 0 ? strip.length - 1 : after;
    const a = Math.max(0, b - 1);
    const f =
      strip[b].time === strip[a].time
        ? 0
        : (pos - strip[a].time) / (strip[b].time - strip[a].time);
    const near = f < 0.5 ? a : b;
    const mix = (va: number | null, vb: number | null) =>
      va === null ? vb : vb === null ? va : va + (vb - va) * f;
    const hour = stripHours?.[near];
    const level = tide ? tideAt(tide.curve, pos) : null;
    const soon = tide ? tideAt(tide.curve, pos + 15 * 60000) : null;
    return {
      wind: mix(series[a].wind, series[b].wind),
      gust: mix(series[a].gust, series[b].gust),
      waves: mix(series[a].waves, series[b].waves),
      tide: level,
      rising: level !== null && soon !== null ? soon >= level : null,
      from: hour?.from ?? null,
      hour,
      at: near,
    };
  }, [series, pos, strip, stripHours, tide]);

  // What the paired station measured at the playhead's hour, at or before
  // now: at the hour now (the column nearest it, which may be the next
  // whole hour), its latest reading while fresh; before it, the reading of
  // that hour. After now there is only the forecast.
  const measuredHere = useMemo(() => {
    if (!measured || pos > now + HOUR / 2) return null;
    if (now - pos < HOUR) return measuredNow(measured, now);
    const r = readingAt(measured.station, pos);
    return r && { paired: measured, reading: r };
  }, [measured, pos, now]);

  const label = spot
    ? `Forecast for ${spot.name}`
    : "Forecast time, for the whole chart";

  return (
    <div
      ref={bar}
      className={`scrub${named ? "" : " is-bare"}`}
      role="region"
      aria-label={label}
      tabIndex={-1}
      data-spot={spot?.id || undefined}
      // The place's hours are in: the strip draws them.
      data-ready={(named && !!stripHours) || undefined}
    >
      {reachable && (
        <div className="map-reach" role="status">
          <button
            type="button"
            className="map-reach-chip"
            onClick={onShowOnMap}
          >
            <Layers3 size={13} strokeWidth={1.5} aria-hidden="true" />
            <span>Show {reachable.name} on the map</span>
          </button>
        </div>
      )}

      {/* The spot's name, and the way to its page, for a screen reader and
          the keys: on the screen they are its name beside it on the map.
          Shown while the link has the focus. */}
      {spot && <h2 className="sb-name sr-only">{spot.name}</h2>}
      {/* A point's coordinates: its name where no place names it. */}
      {isPoint && spot && (
        <p className="sb-coords sr-only">{spot.county || spot.name}</p>
      )}
      {spot && href && (
        <a className="sb-page" href={href} data-spot-page-link>
          Full forecast <span aria-hidden="true">→</span>
        </a>
      )}
      <Readout
        time={pos}
        reading={reading}
        named={named}
        isPoint={isPoint}
        dark={
          reading && !daylight[reading.at]
            ? // With the night hidden, an unlit hour left is twilight.
              hideNight
              ? "Twilight"
              : "Dark"
            : null
        }
        waves={lanes.some((l) => l.kind === "waves")}
        tide={!!tide}
        units={units}
        waveUnits={waveUnits}
        measured={measuredHere}
        withStars={
          rated && rated.of
            ? {
                spots: rated.columns[nearestColumn(strip, pos)]?.spots ?? 0,
                of: rated.of,
              }
            : null
        }
      />

      <div ref={track} className="sb-strip">
        <TimeStrip
          stops={stopTimes}
          line={line}
          at={selected}
          now={now}
          onPick={pick}
          onMove={setPos}
          draw={draw}
          drawHeight={height}
        />
        {/* Over the playhead: its knob, and a dot on each curve at the moment. */}
        <svg className="sb-head" width={1} height={height} aria-hidden="true">
          {reading?.wind != null && series && (
            <circle className="sb-dot" cx={0} cy={y(reading.wind)} r={3.5} />
          )}
          {lanes.map((lane) => {
            const v = reading?.[lane.kind];
            return v != null ? (
              <circle
                key={lane.kind}
                className="sb-dot"
                cx={0}
                cy={laneY.get(lane.kind)!(v)}
                r={2.5}
              />
            ) : null;
          })}
          <circle className="sb-knob" cx={0} cy={4} r={5} />
        </svg>
        {/* The bands' names and the wind's scale, in a column of their own
            beside the hours: no figure is ever under one. */}
        <div className="sb-bands" style={{ height }} aria-hidden="true">
          {named ? (
            <>
              <span className="sb-band" style={{ top: CURVE_TOP }}>
                Wind{units === "bft" ? "" : ` ${unitLabel(units)}`}
              </span>
              {series &&
                windTicks.map((kn) => (
                  <span key={kn} className="sb-tick" style={{ top: y(kn) }}>
                    {speedShort(kn, units)}
                  </span>
                ))}
              {!isPoint && (
                <span
                  className="sb-band is-mid"
                  style={{ top: starsY + STARS_H / 2 }}
                >
                  Stars
                </span>
              )}
              {lanes.map((lane) => (
                <span
                  key={lane.kind}
                  className="sb-band is-mid"
                  style={{ top: lane.top + LANE_H / 2 }}
                >
                  {lane.kind === "waves" ? "Waves" : "Tide"}
                </span>
              ))}
            </>
          ) : (
            rated && <span className="sb-band">Spots with stars</span>
          )}
        </div>
      </div>

      {/* The time, for a keyboard and a screen reader: the strip is the
          slider a finger and a mouse use, and this steps it. Out of sight;
          its focus ring is drawn on the strip. */}
      <input
        type="range"
        className="sr-only sb-time"
        aria-label="Forecast time"
        min={0}
        max={Math.max(0, stops.length - 1)}
        step={1}
        value={selected}
        aria-valuetext={column ? timeSpoken(column.time) : ""}
        onChange={(event) => onSelect(Number(event.target.value))}
        onKeyDown={(event) => {
          // A day at a time with Page Up and Page Down, to the same hour.
          if (event.key !== "PageUp" && event.key !== "PageDown") return;
          event.preventDefault();
          onSelect(
            dayStep(stops, stopDays, selected, event.key === "PageUp" ? 1 : -1),
          );
        }}
      />
    </div>
  );
}

/** The stars of an hour; a warning or a notice that takes them away has none. */
function starsOf(hour: PlaceHour | undefined): number {
  return hour?.warning?.replacesRating || hour?.water?.replacesRating
    ? 0
    : (hour?.rating?.stars ?? 0);
}

/** One column's wind and gust, wave height and tide. */
interface SeriesPoint {
  wind: number | null;
  gust: number | null;
  waves: number | null;
  tide: number | null;
}

/**
 * The forecast drawn along the strip, under its notches: the night hatched,
 * the days' lines, the wind's curve with the gusts dashed over it, the row of
 * stars, a lane each for the waves and the tide, or with no place chosen the
 * spots with stars at each hour; the hours gone faded and the line at now.
 */
function StripDrawing({
  g,
  id,
  strip,
  series,
  hidden,
  named,
  isPoint,
  height,
  bareBottom,
  curveBottom,
  starsY,
  y,
  windTicks,
  lanes,
  laneY,
  starRuns,
  spotBars,
  nights,
  days,
  now,
}: {
  g: StripGeometry;
  id: string;
  strip: readonly StripColumn[];
  series: readonly SeriesPoint[] | null;
  hidden: readonly boolean[] | null;
  named: boolean;
  isPoint: boolean;
  height: number;
  bareBottom: number;
  curveBottom: number;
  starsY: number;
  y: (value: number) => number;
  windTicks: readonly number[];
  lanes: readonly Lane[];
  laneY: ReadonlyMap<Lane["kind"], (v: number) => number>;
  starRuns: readonly StarRun[];
  spotBars: readonly {
    at: number;
    from: number;
    to: number;
    height: number;
    best: number;
  }[];
  nights: readonly { from: number; to: number }[];
  days: ReturnType<typeof stripDays>;
  now: number;
}) {
  const { x, width } = g;
  const first = strip[0]?.time ?? now;
  const last = strip[strip.length - 1]?.time ?? now;
  /** A line through the columns, smoothed, and the area under it to `bottom`. */
  const shape = (
    pick: (s: SeriesPoint) => number | null,
    to: (v: number) => number,
    bottom: number,
  ) => {
    if (!series) return null;
    // A stretch with no value (a source that ends, or has a gap) breaks the
    // curve rather than drawing a line across it.
    const runs: (readonly [number, number])[][] = [];
    let run: (readonly [number, number])[] = [];
    series.forEach((s, at) => {
      const v = pick(s);
      // A column after dark, hidden, breaks it too: the days either side of
      // a night are not one curve.
      if (v === null || hidden?.[at]) {
        if (run.length) runs.push(run);
        run = [];
      } else run.push([x(strip[at].time), to(v)] as const);
    });
    if (run.length) runs.push(run);
    const lines = runs.filter((r) => r.length > 1);
    if (!lines.length) return null;
    return {
      line: lines.map((points) => smooth(points, bottom)).join(" "),
      area: lines
        .map(
          (points) =>
            `${smooth(points, bottom)} L${points[points.length - 1][0].toFixed(1)},${bottom} L${points[0][0].toFixed(1)},${bottom} Z`,
        )
        .join(" "),
    };
  };
  const wind = shape((s) => s.wind, y, curveBottom);
  const gust = wind ? shape((s) => s.gust, y, curveBottom) : null;
  const laneShapes = lanes.map((lane) => ({
    lane,
    shape: shape((s) => s[lane.kind], laneY.get(lane.kind)!, lane.bottom),
  }));
  const foot = named ? height : bareBottom;
  const nowX = x(Math.max(first, Math.min(last, now)));
  return (
    <svg width={width} height={height} aria-hidden="true">
      <defs>
        <pattern
          id={`${id}hatch`}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="5" className="sb-hatch" />
        </pattern>
        {wind && series && (
          <linearGradient
            id={`${id}wind`}
            gradientUnits="userSpaceOnUse"
            x1={0}
            x2={width}
            y1={0}
            y2={0}
          >
            {series.map((s, at) =>
              s.wind === null || hidden?.[at] ? null : (
                <stop
                  key={at}
                  offset={Math.max(0, Math.min(1, x(strip[at].time) / width))}
                  stopColor={windCss(s.wind)}
                />
              ),
            )}
          </linearGradient>
        )}
        {starRuns.map((run, i) => (
          <linearGradient
            key={i}
            id={`${id}stars${i}`}
            gradientUnits="userSpaceOnUse"
            x1={x(run.from)}
            x2={x(run.to)}
            y1={0}
            y2={0}
          >
            {run.stops.map((stop) => (
              <stop
                key={stop.at}
                offset={(stop.at - run.from) / Math.max(1, run.to - run.from)}
                style={{
                  stopColor: `var(--color-stars-${Math.min(5, stop.stars)})`,
                }}
              />
            ))}
          </linearGradient>
        ))}
      </defs>

      {nights.map((n) => (
        <rect
          key={n.from}
          className="sb-night"
          x={x(n.from)}
          y={0}
          width={Math.max(0, x(n.to) - x(n.from))}
          height={foot}
          fill={`url(#${id}hatch)`}
        />
      ))}
      {days.slice(1).map((d) => {
        const at = x(
          strip[d.start].time -
            (strip[d.start].time - strip[d.start - 1].time) / 2,
        );
        return (
          <line
            key={d.date}
            className="sb-day"
            x1={at}
            x2={at}
            y1={0}
            y2={foot}
          />
        );
      })}
      {wind &&
        windTicks.map((kn) => (
          <line
            key={kn}
            className="sb-grid"
            x1={x(first)}
            x2={x(last)}
            y1={y(kn)}
            y2={y(kn)}
          />
        ))}
      {spotBars.length > 0 && (
        <g className="sb-spots" data-spot-bars>
          {spotBars.map((bar) => {
            // A bar an hour apart from the next, a little gap between.
            const from = x(bar.from);
            const wide = Math.max(1, x(bar.to) - from);
            const inset = Math.min(4, wide * 0.12);
            return (
              <rect
                key={bar.at}
                x={from + inset}
                y={bareBottom - bar.height}
                width={Math.max(1, wide - 2 * inset)}
                height={bar.height}
                rx={2}
                style={{ fill: `var(--color-stars-${bar.best})` }}
              />
            );
          })}
        </g>
      )}

      {wind && (
        <g data-curve="wind">
          <path
            className="sb-area is-wind"
            d={wind.area}
            fill={`url(#${id}wind)`}
          />
          <path className="sb-line is-wind" d={wind.line} />
          {gust && <path className="sb-gust" d={gust.line} />}
        </g>
      )}
      {laneShapes.map(({ lane, shape }) => (
        <g key={lane.kind} data-lane={lane.kind}>
          <rect
            className="sb-lane"
            x={x(first)}
            y={lane.top}
            width={Math.max(0, x(last) - x(first))}
            height={LANE_H}
            rx={3}
          />
          {shape && (
            <>
              <path className={`sb-area is-${lane.kind}`} d={shape.area} />
              <path className={`sb-line is-${lane.kind}`} d={shape.line} />
            </>
          )}
        </g>
      ))}

      {named && !isPoint && (
        <g className="sb-stars" data-stars>
          <rect
            className="sb-stars-track"
            x={x(first)}
            y={starsY}
            width={Math.max(0, x(last) - x(first))}
            height={STARS_H}
            rx={STARS_H / 2}
          />
          {starRuns.map((run, i) => (
            <rect
              key={i}
              x={x(run.from)}
              y={starsY}
              width={Math.max(STARS_H, x(run.to) - x(run.from))}
              height={STARS_H}
              rx={STARS_H / 2}
              fill={`url(#${id}stars${i})`}
            />
          ))}
        </g>
      )}

      {/* The hours gone, faded, and the line at now. */}
      {now > first && (
        <rect
          className="sb-past"
          x={0}
          y={0}
          width={Math.max(0, nowX)}
          height={height}
        />
      )}
      {now >= first && now <= last && (
        <line
          className="sb-now-line"
          data-now
          x1={nowX}
          x2={nowX}
          y1={0}
          y2={foot}
        />
      )}
    </svg>
  );
}

/** "Wed 4 13:40": the playhead's moment, to the nearest ten minutes. */
export function momentWords(time: number): string {
  const rounded = Math.round(time / 600000) * 600000;
  return `${dayShort(rounded)} ${Number(irishDate(rounded).slice(8))} ${clock(rounded)}`;
}

/**
 * The moment in hand, over the strip: the time, then the wind, the stars,
 * the waves and the tide, each in a cell of its own that keeps its place
 * as the playhead moves, an hour without a reading saying "–". With no
 * place chosen, the time and how to choose one.
 */
function Readout({
  time,
  reading,
  named,
  isPoint,
  dark,
  waves,
  tide,
  units,
  waveUnits,
  measured,
  withStars,
}: {
  /** What the paired station measured at the hour, or null for the forecast's. */
  measured: MeasuredReading | null;
  /** With no place chosen: how many spots have stars at the hour. */
  withStars: { spots: number; of: number } | null;
  time: number;
  reading: {
    wind: number | null;
    gust: number | null;
    waves: number | null;
    tide: number | null;
    rising: boolean | null;
    from: number | null;
    hour: PlaceHour | undefined;
  } | null;
  named: boolean;
  isPoint: boolean;
  /** What an unlit hour is called, where the playhead is on one. */
  dark: "Dark" | "Twilight" | null;
  /** The place has a lane of waves, and of tide: their cells are kept. */
  waves: boolean;
  tide: boolean;
  units: Units;
  waveUnits: WaveUnits;
}) {
  const when = (
    <div className="sb-cell is-time">
      <b className="sb-time-words">{momentWords(time)}</b>
    </div>
  );
  if (!named || !reading)
    return (
      <div className="sb-readout is-bare" data-readout>
        {when}
        <p className="sb-hint">
          {withStars && (
            <b>
              {withStars.spots} of {withStars.of} spots have stars.{" "}
            </b>
          )}
          Tap the map for a forecast
        </p>
      </div>
    );
  const { wind, gust, from, hour } = reading;
  const stars =
    hour?.warning?.replacesRating || hour?.water?.replacesRating
      ? 0
      : (hour?.rating?.stars ?? null);
  const unit = units === "bft" ? "" : ` ${unitLabel(units)}`;
  return (
    <div
      className="sb-readout"
      data-readout
      // The hour's stars, where it is rated.
      data-stars={!isPoint && hour?.rating ? (stars ?? 0) : undefined}
    >
      {when}
      <div
        className={`sb-cell is-wind${measured ? " is-measured" : ""}`}
        data-cell="wind"
        data-measured={measured?.paired.station.id}
      >
        {measured ? (
          <span
            className="sb-label"
            title={`Measured at ${pairedName(measured.paired)}, ${measuredAt(measured.reading.time)}`}
          >
            Measured · {pairedName(measured.paired)}
          </span>
        ) : (
          <span className="sb-label">Wind</span>
        )}
        <span className="sb-value">
          {measured ? (
            <>
              <i className="sb-swatch is-measured" />
              <b>
                {speedShort(measured.reading.windKn, units)}
                {unit}
              </b>
              {measured.reading.gustKn !== null && (
                <span className="sb-soft">
                  g{speedShort(measured.reading.gustKn, units)}
                </span>
              )}
              {measured.reading.from !== null && (
                <span className="sb-dir">
                  <WindArrow from={measured.reading.from} size={12} />
                  {compass(measured.reading.from)}
                </span>
              )}
            </>
          ) : wind === null ? (
            "–"
          ) : (
            <>
              <i className="sb-swatch" style={{ background: windCss(wind) }} />
              <b>
                {speedShort(wind, units)}
                {unit}
              </b>
              {gust !== null && (
                <span className="sb-soft">g{speedShort(gust, units)}</span>
              )}
              {from !== null && (
                <span className="sb-dir">
                  <WindArrow from={from} size={12} />
                  {compass(from)}
                </span>
              )}
            </>
          )}
        </span>
      </div>
      {!isPoint && (
        <div className="sb-cell is-stars" data-cell="stars">
          <span className="sb-label">Stars</span>
          <span className="sb-value">
            {stars ? (
              <StarGlyphs stars={stars} size={11} slots="potential" coloured />
            ) : (
              <span className="sb-none">{dark ?? "None"}</span>
            )}
          </span>
        </div>
      )}
      {waves && (
        <div className="sb-cell is-waves" data-cell="waves">
          <span className="sb-label">Waves</span>
          <span className="sb-value">
            <b>
              {reading.waves === null
                ? "–"
                : waveText(reading.waves, waveUnits)}
            </b>
          </span>
        </div>
      )}
      {tide && (
        <div className="sb-cell is-tide" data-cell="tide">
          <span className="sb-label">Tide</span>
          <span className="sb-value">
            {reading.tide === null ? (
              "–"
            ) : (
              <>
                <b>{reading.tide.toFixed(1)} m</b>
                {reading.rising !== null && (
                  <span className="sb-soft">{reading.rising ? "↑" : "↓"}</span>
                )}
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

/** A line through points, smoothed (Catmull–Rom, as cubic Béziers). */
function smooth(
  points: readonly (readonly [number, number])[],
  bottom: number,
): string {
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(points[0][0])},${f(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${f(c1x)},${f(Math.min(bottom, c1y))} ${f(c2x)},${f(Math.min(bottom, c2y))} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}
