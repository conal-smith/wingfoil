/**
 * A riding place as a spot report: the spots around it in a thin strip, its
 * name, then the days, what it is like now on small cards beside a small
 * satellite picture with the chart's loupe, and the graphs, each with the days
 * along its head (or the table), and the spot's own notes. Two faces,
 * sentence-case labels, the stars as stars.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MIN_ARROW_MS,
  currentFigure,
  currentText,
  currentUnits,
} from "../../../force5/src/currentReading";
import { faintRose, loupeRose, roseScale } from "../../../force5/src/focus";
import { modelName } from "../../../force5/src/lead";
import { modelEntry, modelHue } from "../../../force5/src/manifests";
import { POINT_SOURCE_KM } from "../../../force5/src/pointSource";
import { rainTint, DRY_MM_PER_HOUR } from "../../../force5/src/rain";
import { shoreFacing } from "../../../force5/src/shoreFacing";
import { shoreAngle, type ShoreAngle } from "../../../force5/src/stars";
import { CHART_HREF, spotHref } from "../../../force5/src/siteNav";
import { LEVEL_LABEL, MET_WARNINGS_PAGE } from "../../../force5/src/warnings";
import { BEACHES_PAGE } from "../../../force5/src/waterQuality";
import type { Rider } from "../../../force5/src/stars";
import {
  FEET_PER_METRE,
  unitLabel,
  waveFigure,
  waveRange,
  waveText,
  type Units,
  type WaveUnits,
} from "../../../force5/src/units";
import {
  NETWORK_LABEL,
  observationAge,
  type SeaTemperatureNetwork,
} from "../../../force5/src/seaTemperature";
import { windCss } from "../../../force5/src/windCss";
import {
  measuredAt,
  measuredNow,
  pairStation,
  pairedName,
  type MeasuredReading,
  type Paired,
  type WindReading,
} from "../../../force5/src/windObs";
import { useWindObs } from "../../../shared/web/useWindObs";
import type {
  NearbySpot,
  RidingSpot,
  SpotForecast,
  SpotSea,
} from "../../../mcp/api/forecast";
import {
  useSpotCurrents,
  type SpotCurrents,
} from "../../../shared/web/useSpotCurrents";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X as Cross } from "lucide-react";
import { Button, Disclosure, NoticeMark, Segmented } from "../../../ui";
import type { NightHours } from "../../../force5/src/prefs";
import {
  afterDark,
  fold,
  keptSpans,
  unfolded,
  type Fold,
} from "../../../shared/web/afterDark";
import { RatingTip } from "../../../ui/RatingTip";
import { starsText } from "../../../force5/src/stars";
import { warningName } from "../Warnings";
import { noticeWords, restrictionShort } from "../WaterQuality";
import { NO_RING, RING, tv } from "../../../ui/tv";
import { useClickLeavesNoRing } from "../../../ui/useClickLeavesNoRing";
import { SkyGlyph } from "../glyphs";
import { pictureCredit, type PictureTide } from "../satellite";
import {
  REPORT_DAYS,
  HOUR,
  clock,
  compass,
  daySun,
  dayNames,
  dublinDate,
  nextStarWindow,
  type StarWindow,
  dublinHour,
  dublinMidnight,
  groupDays,
  gustShown,
  windSay,
  leadChanges,
  spotRows,
  tideCurve,
  tideHeightAt,
  tideTurns,
  type DaySun,
  type SpotRow,
} from "../spot";
import { useSpotPicture } from "../useSpotPicture";
import { useWidth } from "../useWidth";
import { launchBed, launchDepth, type LaunchBed } from "./launch";
import {
  GUST_WORDS,
  gustReading,
  modelSeries,
  rainPerHour,
  rowIndexAt,
  rowRain,
  type ModelSeries,
} from "./detail";
import { useNearby, type NearbyReading } from "./nearby";
import { ClimateSections, useSheltered } from "./ClimateSections";
import { WAVE_BLEND, waveLeadOrder } from "../../../force5/src/waves";
import {
  PART_ROWS,
  partOf,
  waveHandovers,
  waveWeek,
  windBlend,
  type PartRow,
  type WaveRow,
  type WaveWeek,
  type WindBlendAt,
} from "./blends";
import { spotSquare } from "../../../force5/src/spotData";
import { useWaveBlend } from "../../../shared/web/useWaveBlend";
import {
  waveBlendHours,
  type WavePartHour,
} from "../../../force5/src/waveBlend";
import { PhotoLoupe } from "./PhotoLoupe";
import {
  besideMark,
  dayCard,
  rowAt,
  smoothPath,
  standIn,
  type DayCard,
} from "./report";

const styles = tv({
  slots: {
    main: "flex flex-col pb-12",
    title: "flex items-center justify-between gap-4 pt-2 pb-2",
    name: "m-0 font-display text-big-sm font-semibold text-ink wide:text-big",
    acts: "flex shrink-0 items-center gap-2",
    // What it is like now: three small cards and the picture, under the days.
    nowBlock:
      "mt-2 grid grid-cols-2 gap-2 wide:grid-cols-3 rail:grid-cols-nowblock rail:gap-3",
    nowCard: [
      "flex min-w-0 flex-col justify-center gap-0.5 rounded-surface bg-sunken on-card px-3.5 py-2",
      "cards:flex-row cards:items-end cards:justify-between cards:gap-3",
    ],
    // On a phone the stars have a row to themselves, the word and what is
    // next side by side.
    nowCardStars:
      "col-span-2 flex-row items-end justify-between gap-3 wide:col-span-1 wide:flex-col wide:items-start wide:justify-center wide:gap-0.5 cards:flex-row cards:items-end cards:justify-between cards:gap-3",
    nowHead: "grid min-w-0 gap-0.5",
    nowLabel:
      "block truncate font-body text-caption font-medium whitespace-nowrap text-ink-muted wide:text-label",
    nowFigure:
      "flex min-w-0 items-baseline gap-1.5 font-body text-lead font-semibold whitespace-nowrap text-ink tabular-nums rail:text-big-sm",
    nowUnit: "text-body font-medium text-ink-2",
    nowGust: "text-gust-ink",
    nowLine:
      "block min-w-0 truncate font-body text-body whitespace-nowrap text-ink-2 tabular-nums cards:shrink-0 cards:text-right cards:text-label",
    nowWord: "text-lead font-semibold",
    // The next stars, the time alone a link.
    nowNext:
      "flex min-w-0 items-center gap-1.5 font-body text-body whitespace-nowrap text-ink-2 tabular-nums cards:shrink-0 cards:text-label",
    nowQuiet: "font-normal text-ink-2",
    line: "font-body text-prose text-ink-2",
    off: "text-pen",
    notices: "pb-1",
    sectionHead: "mb-3.5 flex flex-wrap items-center justify-between gap-2.5",
    h2: "m-0 font-body text-lead font-semibold text-ink",
    section: "pt-9",
    link: [
      "font-body text-body font-medium text-ink underline underline-offset-4 decoration-line",
      RING,
    ],
    // The spots around, nearest first, the one you are on first of all.
    nearRow:
      "flex items-center gap-1 overflow-x-auto scrollbar-none py-1.5 font-body text-body",
    near: [
      "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 whitespace-nowrap text-ink no-underline",
      "transition-colors duration-fast hover:bg-sunken",
      RING,
    ],
    nearHere: "bg-inverse font-semibold text-ink-inverse hover:bg-inverse",
    nearName: "font-medium",
    nearWind: "text-ink-2 tabular-nums",
    nearAll: "ml-1 shrink-0",
    // A card a day, as many as the forecast reaches: they share the width
    // while they fit, and scroll sideways past it.
    week: "relative flex min-w-0 flex-1 gap-2 overflow-x-auto scrollbar-none",
    weekRow: "flex items-center gap-1.5",
    // The outline round the days the graph has on screen, laid over the
    // strip and slid along it as the graph scrolls (`paintDayWindow`).
    dayWindow:
      "pointer-events-none absolute top-0 bottom-0 z-1 rounded-surface inset-ring-2 inset-ring-ink-2",
    day: [
      "grid min-w-26 flex-1 shrink-0 content-start gap-1 rounded-surface border-0 bg-sunken on-card p-2 text-left text-ink",
      "cursor-pointer transition-colors duration-fast hover:bg-line",
      RING,
    ],
    // The day the selection is on: its name on a capsule, in ink.
    dayOn: "rounded-full bg-inverse px-1.5 text-ink-inverse",
    dayName:
      "justify-self-start font-body text-body font-semibold whitespace-nowrap",
    dayDate: "ml-1 font-normal opacity-70",
    range: "font-body text-body font-semibold whitespace-nowrap",
    small: "font-body text-caption font-normal text-ink-muted",
    spark: "block h-5 w-full",
    // Where the wind at Now was measured: quiet, on the card's label.
    roSource: "font-normal",
    // The band names in a column of their own beside the hours, narrower on
    // a phone, so no name ever sits over an hour's figures.
    gbox: "relative grid grid-cols-graph-narrow rounded-surface bg-sunken on-card pb-1.5 wide:grid-cols-graph",
    gl: "relative border-0 border-r border-line",
    // The days along the top of each graph, on the graph's own hours: each
    // name held at the strip's left edge while its day is on screen, and held
    // at the top of the screen while its graph is.
    dayHeads:
      "sticky top-0 z-3 col-span-full grid h-8 grid-cols-graph-narrow items-center rounded-t-surface bg-sunken wide:grid-cols-graph",
    headStrip: "h-full overflow-hidden",
    headRow: "relative h-full",
    dayHead: "absolute top-0 h-full border-0 border-l border-line",
    dayHeadFirst: "border-l-0",
    dayHeadName:
      "sticky left-0 inline-flex h-full items-center gap-1.5 bg-sunken pr-3 pl-2 font-body text-body font-semibold whitespace-nowrap text-ink",
    dayHeadLight: "font-normal text-ink-muted tabular-nums",
    // The rail along the top of each graph's plot, its own lane for what
    // says the hour, so nothing there covers a name or a figure: the hour
    // under the cursor (or held, or stepped to with the keys).
    cursorSpot:
      "pointer-events-none absolute top-1 z-2 inline-flex -translate-x-1/2 items-center",
    cursorTag: [
      "inline-flex items-center gap-1 rounded-full bg-inverse px-2 py-0.5",
      "font-body text-label font-semibold whitespace-nowrap text-ink-inverse tabular-nums",
    ],
    cursorTagFocus: "outline-2 outline-offset-2 outline-focus",
    // Let go of a held hour, inside the tag that says it.
    letGo:
      "pointer-events-auto -mr-1 size-4 text-ink-inverse hover:bg-transparent hover:opacity-70",
    // Where now is, on the same rail.
    nowTag:
      "pointer-events-none absolute top-1 z-1 -translate-x-1/2 rounded-full bg-sunken px-1.5 py-0.5 font-body text-label font-semibold whitespace-nowrap text-now",
    // The two arrows at the strip's end that move the hours a day at a time.
    arrows: "flex shrink-0 items-center gap-0.5 max-wide:hidden",
    // A band's name, in a strip as tall as its band.
    glBand: "absolute inset-x-0",
    glUnit:
      "block h-4 pl-1.5 font-body text-caption leading-4 font-normal whitespace-nowrap text-ink-muted wide:pl-4",
    glName: [
      "block h-4 pl-1.5 font-body text-caption leading-4 font-medium whitespace-nowrap text-ink-muted wide:pl-4",
    ],
    // Sideways through the hours without a bar drawn over them: a wheel, a
    // drag, the arrows in the head or the strip of days moves them. The
    // focus ring stands on the cursor's tag, never round the whole graph.
    graph: [
      "mask-fade-x relative overflow-x-auto overscroll-x-contain scrollbar-none",
      NO_RING,
    ],
    // The week's two sections, Wind and then Waves, each under a heading
    // with the models it reads beside it.
    weekHead:
      "mt-3 mb-1 flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1",
    weekTitle: "flex items-center gap-3",
    h3: "m-0 font-body text-lead font-semibold text-ink",
    weekSub: "font-body text-body text-ink-muted",
    // The small label beside the pointer or under a finger: the hour, then
    // what the row under it says that is not easily read from the screen.
    hourLabel: [
      "pointer-events-none absolute z-6 grid max-w-52 -translate-y-1/2 gap-px rounded-control bg-ground px-2 py-1 shadow-float inset-ring-1 inset-ring-line",
      "font-body text-label whitespace-nowrap text-ink tabular-nums",
    ],
    hourLabelLine: "flex items-center gap-1.5",
    hourLabelQuiet: "font-normal text-ink-2",
    hourLabelModel: "flex items-center gap-1.5",
    sky: "pointer-events-none absolute left-0 flex items-center gap-1 rounded-control font-body text-caption text-ink-2",
    skyNight: "bg-night-ground",
    // The key under the graph: its groups in a row, each a small heading
    // over its marks, every mark drawn at one size; two to a row on a phone.
    legend: [
      "grid grid-cols-2 gap-x-6 gap-y-5 px-1 pt-5 font-body text-caption text-ink-2",
      "wide:flex wide:flex-wrap wide:gap-x-14 wide:px-4",
    ],
    kGroup: "grid min-w-0 content-start gap-2",
    kHead: "font-medium text-ink-muted",
    kList: "m-0 grid list-none gap-1.5 p-0",
    kItem: "flex min-w-0 items-start gap-2.5",
    kMark: "mt-0.5 h-3 w-5 shrink-0 overflow-visible",
    kWords: "min-w-0",
    kFigure:
      "ml-auto min-w-6 pl-2 text-right font-semibold text-ink tabular-nums",
    table:
      "w-full border-collapse overflow-hidden rounded-surface bg-sunken on-card font-body text-body",
    th: "px-3 pt-3 pb-2.5 text-left font-medium whitespace-nowrap text-ink-muted",
    td: "border-0 border-t border-line px-3 py-2.5 whitespace-nowrap",
    narrow: "hidden wide:table-cell",
    guide: "grid gap-3 wide:grid-cols-2 cards:grid-cols-4",
    // The picture's card: what the rose reads and the tide switch, beside
    // the square of satellite picture.
    pictureCard: "col-span-2 wide:col-span-3 rail:col-span-1",
    pictureSide:
      "flex min-w-0 flex-1 flex-col justify-between gap-1.5 px-3 py-2",
    pictureHour:
      "block truncate font-body text-label font-medium text-ink-muted",
    foot: "block min-w-0 truncate font-body text-body font-semibold whitespace-nowrap text-ink tabular-nums",
    footGust: "text-caption text-gust-ink",
    seg: "self-start",
    gd: "rounded-surface bg-sunken on-card p-4 wide:px-5",
    gdHead: "m-0 mb-1.5 font-body text-prose font-semibold text-ink",
    gdText: "m-0 font-body text-prose text-ink-2",
    smallPrint: "grid gap-1 pt-8 font-body text-caption text-ink-muted",
  },
});

const STAR =
  "M12 2.6l2.75 5.6 6.15.9-4.45 4.35 1.05 6.1L12 16.65l-5.5 2.9 1.05-6.1L3.1 9.1l6.15-.9z";
const STAR_FILL = [
  "fill-line",
  "fill-stars-1",
  "fill-stars-2",
  "fill-stars-3",
  "fill-stars-4",
  "fill-stars-5",
];

/** The star rating, as stars: filled in the rating's colour, the rest faint. */
export function Stars({ n, size = 13 }: { n: number; size?: number }) {
  return (
    <span
      className="inline-flex items-center gap-px align-middle"
      role="img"
      aria-label={`${n} of 5 stars`}
      data-stars={n}
    >
      {[1, 2, 3, 4, 5].map((k) => (
        <svg
          key={k}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d={STAR} className={k <= n ? STAR_FILL[n] : STAR_FILL[0]} />
        </svg>
      ))}
    </span>
  );
}

/** The rider's wind units, for every figure the report writes. */
const UnitsContext = createContext<Units>("kn");
function useSpeed() {
  const units = useContext(UnitsContext);
  return {
    /** "16", or "F4" in Force. */
    say: (kn: number) => windSay(kn, units),
    /** The gust worth writing beside a wind, or null. */
    gust: (kn: number, gust: number | null) => gustShown(kn, gust, units),
    /** "kn", "mph"…; nothing in Force, whose figures say it. */
    unit: units === "bft" ? "" : unitLabel(units),
  };
}

/** The rider's wave units, for every height the report writes. */
const WaveUnitsContext = createContext<WaveUnits>("ft");
function useHeights() {
  const units = useContext(WaveUnitsContext);
  return {
    /** The figure in a row: "3", "<1" or "0.7". */
    figure: (m: number) => waveFigure(m, units),
    /** With its unit: "3 ft", "under 1 ft" or "0.7 m". */
    text: (m: number) => waveText(m, units),
    /** A range with its unit: "1–3 ft". */
    range: (low: number, high: number) => waveRange(low, high, units),
    unit: units,
  };
}

const isOff = (shore: ShoreAngle | null | undefined) =>
  shore === "offshore" || shore === "cross-off";
const shoreWord = (shore: ShoreAngle | null | undefined) =>
  !shore ? null : shore === "cross" ? "cross-shore" : shore;
/** The shore a measured wind blows at, where the shore and the wind say. */
const measuredShore = (m: MeasuredReading, facing: number | null) =>
  facing === null || m.reading.from === null
    ? null
    : shoreAngle(m.reading.from, facing);

/**
 * A point on the open water, where the report is a point's
 * (spot/web/point.ts): the riding places around it, nearest first, and the
 * one it borrows its waves, weather, sea and tide from, if one is near.
 */
export interface ReportPoint {
  nearby: readonly NearbySpot[];
  lender: RidingSpot | null;
}

export function SpotReport({
  spot,
  forecast,
  rider,
  units,
  waveUnits = "ft",
  nightHours = "show",
  now,
  at = null,
  blendModels = [],
  waveModel = null,
  point = null,
  actions,
  notices,
}: {
  spot: RidingSpot;
  forecast: SpotForecast;
  rider: Rider;
  units: Units;
  /** The units every wave and swell height is shown in (Settings). */
  waveUnits?: WaveUnits;
  /**
   * Whether the week shows the hours after dark (Settings): hidden, its
   * graph is each day's hours from first light to last, the days side by
   * side (shared/web/afterDark.ts).
   */
  nightHours?: NightHours;
  now: number;
  /**
   * The hour the week opens at (`?at=`), as if the rider had put the pointer
   * on it; null, or an hour the week does not hold, opens it on now.
   */
  at?: number | null;
  /** The models the rider blends (Settings): the Wind blend band's lines. */
  blendModels?: readonly string[];
  /**
   * The wave model the rider reads the waves from (Settings), handed on past
   * its run; null for the finest model at each hour.
   */
  waveModel?: string | null;
  /** A point on the open water's report: no shore, so no stars. */
  point?: ReportPoint | null;
  actions?: React.ReactNode;
  notices?: React.ReactNode;
}) {
  const s = styles();
  useClickLeavesNoRing();
  const facing = point ? null : shoreFacing(spot.id);
  // A point has no shore to rate the wind against, so its hours have no
  // stars: rated on the wind alone, they would say a beach's verdict about
  // water nobody launches from.
  const rows = useMemo(
    () =>
      spotRows(forecast.hours, now, facing, rider).map((row) =>
        point ? { ...row, rating: null } : row,
      ),
    [forecast.hours, now, facing, rider, point],
  );
  const days = useMemo(
    () =>
      groupDays(rows)
        .filter((d) => d.hasWind)
        .slice(0, REPORT_DAYS)
        .map((day) => ({
          day,
          sun: daySun(spot.lat, spot.lon, day.date),
          midnight: dublinMidnight(day.date),
        })),
    [rows, spot.lat, spot.lon],
  );
  const cards = useMemo(
    () => days.map(({ day, midnight }) => dayCard(day, now, midnight)),
    [days, now],
  );
  const turns = useMemo(() => tideTurns(forecast), [forecast]);
  const tideAt = useMemo(() => (t: number) => tideHeightAt(turns, t), [turns]);
  const [bed, setBed] = useState<LaunchBed | null>(null);
  useEffect(() => {
    // A point has no launch, so no water at one.
    if (point) return;
    let current = true;
    void launchBed(spot, facing).then((b) => current && setBed(b));
    return () => {
      current = false;
    };
  }, [spot, facing, point]);
  const depthAt = useMemo(
    () => (t: number) => (bed ? launchDepth(bed, tideAt, t) : null),
    [bed, tideAt],
  );
  const picture = useSpotPicture(spot);
  // The nearest weather station or buoy, whose readings stand beside the
  // forecast: its name and distance go wherever they are shown.
  const obs = useWindObs();
  const paired = useMemo(
    () => (obs ? pairStation(spot, obs.stations) : null),
    [obs, spot.lat, spot.lon],
  );
  // The wind now as that station measured it, while fresh: the Wind now
  // card and a phone's tag at Now both say it, so they never disagree.
  const nowMeasured = useMemo(() => measuredNow(paired, now), [paired, now]);
  const [firstNow] = useState(now);
  const nearby = useNearby(forecast.nearby, rider, firstNow);
  // The rows after dark, where the rider has hidden them: from last light
  // to first light at the spot.
  const dark = useMemo(
    () =>
      nightHours === "hide"
        ? afterDark(
            spot,
            rows.map((row) => row.time),
          )
        : null,
    [nightHours, rows, spot.lat, spot.lon],
  );
  // The hour the address opens the week at, while the rows hold it: the
  // row it falls in, focused as a pointer resting on it would focus it. One
  // after dark, hidden, opens on the next first light.
  const [opening] = useState(() => {
    const row = at === null ? null : rowIndexAt(rows, at);
    if (row === null || !dark) return row;
    const lit = dark.findIndex((night, i) => i >= row && !night);
    return lit < 0 ? null : lit;
  });
  const [focus, setFocus] = useState<number | null>(
    opening === null ? null : rows[opening].time,
  );
  const [view, setView] = useState<"graph" | "table">("graph");
  const [tidePicked, setTide] = useState<PictureTide | null>(null);
  const [dayAt, setDayAt] = useState(() => {
    if (opening === null) return 0;
    const date = dublinDate(rows[opening].time);
    return Math.max(
      0,
      days.findIndex(({ day }) => day.date === date),
    );
  });
  // The current, the place's own (a point's too: the nearest water in the
  // currents' frames), on the rows' hours.
  const currentPlace = useMemo(
    () => ({ id: point ? undefined : spot.id, lat: spot.lat, lon: spot.lon }),
    [point, spot.id, spot.lat, spot.lon],
  );
  const axis = useMemo(
    () => rows.map((row) => new Date(row.time).toISOString()),
    [rows],
  );
  const current = useSpotCurrents(true, currentPlace, axis);
  const rain = useMemo(() => rainPerHour(forecast.hours), [forecast.hours]);
  const models = useMemo(
    () => (point ? [] : modelSeries(rows, blendModels)),
    [rows, blendModels, point],
  );
  const [scrollTo, setScrollTo] = useState<WeekMove | null>(null);
  // The models' blend, said in the Wind blend band alone: the headline wind
  // and the stars stay the one model's own.
  const blend = useMemo(() => windBlend(rows), [rows]);
  // The waves: one model's own at each hour, the rider's or the finest, with
  // the published wave blend beside them where it has the place (a point's
  // are the riding place's it borrows them from).
  const waveFrom = point ? point.lender : spot;
  const squares = useMemo(
    () => (waveFrom ? [spotSquare(waveFrom.lat, waveFrom.lon)] : null),
    [waveFrom?.lat, waveFrom?.lon],
  );
  const { blend: waveBlend } = useWaveBlend(squares);
  const waves = useMemo(
    () =>
      waveWeek(
        rows,
        waveBlend && waveFrom ? waveBlendHours(waveBlend, waveFrom.id) : null,
        waveLeadOrder(waveModel),
        waveModel === WAVE_BLEND,
      ),
    [rows, waveBlend, waveFrom?.id, waveModel],
  );
  // No Waves section on water the open sea's waves do not reach (a lake, a
  // harbour), as the spot's year has none, or where no wave model reaches.
  const sheltered = useSheltered(point ? null : spot.id);
  const seaShown =
    sheltered === false && waves.rows.some((r) => r !== null) ? waves : null;

  const nextStars = useMemo(() => nextStarWindow(rows, now), [rows, now]);
  const nowRow = rowAt(rows, now);
  const shown = focus === null ? nowRow : rowAt(rows, focus);
  // The day the strip marks: the day of the hour read out in the graph, the
  // pressed day in the table.
  const dayOn =
    view === "graph"
      ? Math.max(
          0,
          days.findIndex(
            ({ day }) => day.date === dublinDate(shown?.time ?? now),
          ),
        )
      : dayAt;
  const dayStrip = useDayInView(dayOn);
  // The one hour the top of the page reads, the picture and the cards alike:
  // the hour picked in the week, or now.
  const heroAtNow = shown === nowRow;
  const heroAt = heroAtNow || !shown ? now : shown.time;
  const dayWindow = useRef<HTMLDivElement>(null);
  // Where the graph puts its arrows, at the end of the strip of days.
  const [arrowsAt, setArrowsAt] = useState<HTMLDivElement | null>(null);
  const viewSwitch = (
    <Segmented
      aria-label="View"
      size="sm"
      value={view}
      onChange={(v) => setView(v)}
      options={[
        { value: "graph", label: "Graph" },
        { value: "table", label: "Table" },
      ]}
    />
  );
  // Waves now, as the Waves section reads them, or null where it has none.
  const nowIndex = nowRow ? rows.indexOf(nowRow) : -1;
  const nowWaveRow = seaShown && nowIndex >= 0 ? seaShown.rows[nowIndex] : null;
  /** The next hours with stars, in the week: the Stars cell's jump. */
  const showNextStars = (time: number) => {
    const date = dublinDate(time);
    const day = days.findIndex((d) => d.day.date === date);
    if (day >= 0) {
      setDayAt(day);
      setScrollTo({ day, at: Date.now(), time });
    }
    setFocus(time);
    setView("graph");
    document.getElementById("the-week")?.scrollIntoView({ behavior: "smooth" });
  };
  // A day pressed in the strip, or today: the week lets go of a held hour.
  const [backToNow, setBackToNow] = useState(0);
  // A day pressed: the whole page goes to it, at the hour the rider has picked
  // on the clock, else midday, as the finder opens a day. Today is the hour now.
  const chooseDay = (i: number) => {
    const date = days[i].day.date;
    setDayAt(i);
    setTide(null);
    if (date === dublinDate(now)) {
      setFocus(null);
      setBackToNow(Date.now());
      setScrollTo({ day: i, at: Date.now(), time: null });
      return;
    }
    const clock = focus === null ? 12 : dublinHour(focus);
    const time = rowAt(rows, dublinMidnight(date) + clock * HOUR)?.time ?? null;
    setFocus(time);
    setScrollTo({ day: i, at: Date.now(), time });
  };
  const scale = useMemo(() => roseScale(units), [units]);
  // At Now the picture's rose says the wind the station measured, as the
  // Wind now card and a phone's tag do; a reading with no direction has no
  // rose to draw, so the forecast's stands then.
  const loupeMeasured =
    shown !== null && shown === nowRow && nowMeasured?.reading.from != null
      ? nowMeasured
      : null;
  const loupe = loupeMeasured
    ? loupeRose(
        rider,
        {
          windKn: loupeMeasured.reading.windKn,
          gustKn: loupeMeasured.reading.gustKn,
          from: loupeMeasured.reading.from,
          daylight: shown!.hour.daylight,
        },
        facing,
        units,
      )
    : shown?.hour.wind
      ? loupeRose(
          rider,
          {
            windKn: shown.hour.wind.wind_kn,
            gustKn: shown.hour.wind.gust_kn,
            from: shown.hour.wind.direction_deg,
            daylight: shown.hour.daylight,
          },
          facing,
          units,
        )
      : null;
  const loupeWind = loupeMeasured
    ? {
        windKn: loupeMeasured.reading.windKn,
        from: loupeMeasured.reading.from!,
      }
    : {
        windKn: shown?.hour.wind?.wind_kn ?? null,
        from: shown?.hour.wind?.direction_deg ?? null,
      };
  const loupeFaint = faintRose(
    rider,
    { ...loupeWind, daylight: !!shown?.hour.daylight },
    facing,
  );
  const loupeShore = loupeMeasured
    ? measuredShore(loupeMeasured, facing)
    : shown?.shore;
  const heights = turns.map((t) => t.height);
  const tideHere = tideAt(heroAt);
  const tideShown: PictureTide =
    tideHere !== null &&
    heights.length &&
    tideHere > (Math.max(...heights) + Math.min(...heights)) / 2
      ? "high"
      : "low";
  const tide = tidePicked ?? tideShown;

  return (
    <UnitsContext.Provider value={units}>
      <WaveUnitsContext.Provider value={waveUnits}>
        <main className={s.main()}>
          <section className={s.title()}>
            <div className="grid min-w-0 gap-1">
              <h1 className={s.name()}>{spot.name}</h1>
              {point && <PointLine point={point} />}
            </div>
            <div className={s.acts()}>{actions}</div>
          </section>
          {nearby.length > 0 && (
            <NearbyStrip here={point ? null : spot} readings={nearby} />
          )}
          {notices && <div className={s.notices()}>{notices}</div>}

          <section className="pt-2" aria-labelledby="the-week">
            <h2 className="sr-only" id="the-week">
              The days ahead
            </h2>
            <div className={s.weekRow()}>
              <div
                ref={dayStrip}
                className={s.week()}
                role="group"
                aria-label="Days"
              >
                {cards.map((card, i) => (
                  <DayButton
                    key={card.date}
                    card={card}
                    rated={!point}
                    on={i === dayOn}
                    onClick={() => chooseDay(i)}
                  />
                ))}
                {view === "graph" && (
                  <div
                    ref={dayWindow}
                    className={s.dayWindow()}
                    data-day-window
                    aria-hidden="true"
                  />
                )}
              </div>
              <div ref={setArrowsAt} className={s.arrows()} />
            </div>
            <div className={s.nowBlock()} data-now-block>
              <NowCards
                row={nowRow}
                waves={seaShown && nowWaveRow}
                hasWaves={seaShown !== null}
                sea={forecast.sea_temperature}
                now={now}
                rated={!point}
                facing={facing}
                measured={nowMeasured}
                next={nextStars}
                onShowNext={showNextStars}
                forecast={forecast}
              />
              {picture && (
                <PhotoLoupe
                  picture={picture}
                  tide={tide}
                  loupe={loupe}
                  faint={loupeFaint}
                  facing={facing}
                  scale={scale}
                  className={s.pictureCard()}
                >
                  <div className={s.pictureSide()}>
                    <div
                      className={s.foot()}
                      data-loupe-foot
                      data-measured={loupeMeasured?.paired.station.id}
                    >
                      <span className={s.pictureHour()}>
                        {heroAtNow
                          ? "Now"
                          : `${dayNames(dublinDate(heroAt), heroAt).short} ${clock(heroAt)}`}
                      </span>{" "}
                      {loupe ? (
                        <>
                          {loupe.reading.replace(/ g(\d+)$/, "")}{" "}
                          {/ g\d+$/.test(loupe.reading) && (
                            <span className={s.footGust()}>
                              g{loupe.reading.match(/ g(\d+)$/)![1]}
                            </span>
                          )}
                          {heroAtNow && shoreWord(loupeShore) && (
                            <span className="font-normal text-ink-2">
                              {" · "}
                              {shoreWord(loupeShore)}
                            </span>
                          )}
                        </>
                      ) : (
                        "No wind reading"
                      )}
                    </div>
                    <Segmented
                      aria-label="Tide in the picture"
                      size="sm"
                      className={s.seg()}
                      value={tide}
                      onChange={(t) => setTide(t)}
                      options={[
                        { value: "high", label: "High tide" },
                        { value: "low", label: "Low tide" },
                      ]}
                    />
                  </div>
                </PhotoLoupe>
              )}
            </div>
            {view === "graph" ? (
              <Graph
                rows={rows}
                days={days}
                now={now}
                turns={turns}
                bed={bed}
                depthAt={depthAt}
                onFocus={setFocus}
                backToNow={backToNow}
                scrollTo={scrollTo}
                opening={focus === null ? opening : rowIndexAt(rows, focus)}
                dark={dark}
                rider={rider}
                rated={!point}
                models={models}
                blend={blend}
                waves={seaShown}
                waveModel={waveModel}
                current={current}
                rain={rain}
                measured={paired}
                nowMeasured={nowMeasured}
                strip={dayStrip}
                dayWindow={dayWindow}
                arrowsAt={arrowsAt}
                switcher={viewSwitch}
              />
            ) : (
              <HourTable
                forecast={forecast}
                switcher={viewSwitch}
                rows={days[dayAt]?.day.rows ?? []}
                date={days[dayAt]?.day.date ?? ""}
                now={now}
                turns={turns}
                depthAt={depthAt}
                rider={rider}
                rated={!point}
                rain={rain}
              />
            )}
          </section>

          {point ? (
            <PointGuide point={point} />
          ) : (
            <section className={s.section()} aria-labelledby="the-spot">
              <div className={s.sectionHead()}>
                <h2 className={s.h2()} id="the-spot">
                  The spot
                </h2>
              </div>
              <div className={s.guide()}>
                <div className={s.gd()}>
                  <h3 className={s.gdHead()}>Water</h3>
                  <p className={s.gdText()}>
                    {bed && Number.isFinite(bed.z)
                      ? `1 m deep at the launch above ${(bed.z + 1).toFixed(1)} m of tide.`
                      : bed
                        ? "Deep water at the launch at every tide."
                        : "No survey of the seabed reaches this launch yet."}
                  </p>
                </div>
                {forecast.shore_note && (
                  <div className={s.gd()}>
                    <h3 className={s.gdHead()}>The shore</h3>
                    <p className={s.gdText()}>{forecast.shore_note}</p>
                  </div>
                )}
              </div>
            </section>
          )}
          {!point && (
            <section className={s.section()}>
              <Disclosure
                title="The wind and waves through the year"
                data-disclosure="year"
              >
                <ClimateSections spotId={spot.id} units={units} />
              </Disclosure>
            </section>
          )}
          <div className={s.smallPrint()}>
            <p className="m-0">
              Model forecasts, not a safety statement. Look at the water before
              you go out. Times are Irish.
            </p>
            <p className="m-0" data-warnings-source>
              Weather warnings: Met Éireann,{" "}
              <a
                className={s.link({ className: "text-caption" })}
                href={MET_WARNINGS_PAGE}
              >
                met.ie/warnings
              </a>
              .{" "}
              <span data-water-quality-source>
                {forecast.water_quality.status === "unavailable" &&
                  "Bathing water notices cannot be read just now, so none are taken into account here. "}
                Bathing water notices: the EPA,{" "}
                <a
                  className={s.link({ className: "text-caption" })}
                  href={BEACHES_PAGE}
                >
                  beaches.ie
                </a>
                .
                {forecast.water_quality.status === "not-monitored" &&
                  " No bathing water is monitored near here."}
              </span>
              {picture && ` ${pictureCredit(picture.attribution)}`}
            </p>
          </div>
        </main>
      </WaveUnitsContext.Provider>
    </UnitsContext.Provider>
  );
}

const km = (distance: number) =>
  distance < 10 ? distance.toFixed(1) : String(Math.round(distance));

/**
 * Under a point's name: that it is open water, and the riding place nearest
 * it, however far, with the way to its page, where the stars are.
 */
function PointLine({ point }: { point: ReportPoint }) {
  const s = styles();
  const nearest = point.nearby[0];
  return (
    <p className={s.line({ className: "m-0" })} data-point-line>
      Open water
      {nearest && (
        <>
          {" · "}nearest riding spot{" "}
          <a
            className={s.link({ className: "text-prose" })}
            href={spotHref(nearest.id)}
            data-nearest-spot={nearest.id}
          >
            {nearest.name}
          </a>
          , {km(nearest.distance_km)} km
        </>
      )}
    </p>
  );
}

/**
 * A point's notes, in place of a spot's: why it has no stars, and whose
 * waves, weather and tide it reads, the wind being its own.
 */
function PointGuide({ point }: { point: ReportPoint }) {
  const s = styles();
  const nearest = point.nearby[0];
  const lent = point.lender
    ? point.nearby.find((n) => n.id === point.lender!.id)
    : undefined;
  return (
    <section className={s.section()} aria-labelledby="the-point">
      <div className={s.sectionHead()}>
        <h2 className={s.h2()} id="the-point">
          This point
        </h2>
      </div>
      <div className={s.guide()}>
        <div className={s.gd()} data-point-no-stars>
          <h3 className={s.gdHead()}>No stars</h3>
          <p className={s.gdText()}>
            Stars rate the wind against a shore you launch from, and open water
            has none. Read the wind, the gusts and the sea for yourself
            {nearest ? (
              <>
                , or see the stars at{" "}
                <a className={s.link()} href={spotHref(nearest.id)}>
                  {nearest.name}
                </a>
                .
              </>
            ) : (
              "."
            )}
          </p>
        </div>
        <div className={s.gd()}>
          <h3 className={s.gdHead()}>Where the figures come from</h3>
          <p className={s.gdText()}>
            {point.lender
              ? `The wind is this point's own. The waves, the weather and the tide are ${point.lender.name}'s${lent ? `, ${km(lent.distance_km)} km away` : ""}.`
              : `The wind and the current are this point's own. No riding place is within ${POINT_SOURCE_KM} km to lend it waves, weather or a tide.`}
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * The spots around, nearest first, in one thin line at the top of the page:
 * each its name, the wind there now and today's best stars for this rider.
 * The spot you are on is first, on a capsule. A point on the water is no
 * spot, so it has none of its own (`here` null). The line scrolls sideways
 * where it does not fit, the cut-off item at its edge saying there is more.
 */
function NearbyStrip({
  here,
  readings,
}: {
  here: RidingSpot | null;
  readings: NearbyReading[];
}) {
  const speed = useSpeed();
  const s = styles();
  return (
    <nav className={s.nearRow()} aria-label="Nearby" data-nearby-strip>
      {here && (
        <a
          className={s.near({ className: s.nearHere() })}
          href={spotHref(here.id)}
          aria-current="page"
          data-nearby={here.id}
        >
          <span>{here.name}</span>
        </a>
      )}
      {readings.map((r) => (
        <a
          key={r.id}
          className={s.near()}
          href={spotHref(r.id)}
          data-nearby={r.id}
        >
          <span className={s.nearName()}>{r.name}</span>
          <span className={s.nearWind()}>
            {r.windKn === null
              ? `${r.distanceKm} km`
              : `${speed.say(r.windKn)} ${speed.unit}`.trim()}
          </span>
          {r.best !== null && <Stars n={r.best} size={11} />}
        </a>
      ))}
      <a className={s.link({ className: s.nearAll() })} href={CHART_HREF}>
        All on the chart
      </a>
    </nav>
  );
}

/**
 * What the place is like now, on three small cards under the days: the stars,
 * the wind and the waves. Always this hour's, whichever the graph has
 * selected: it is the picture beside them that follows the hour. With no
 * stars to show, the Stars card says when the next ones are, and takes you
 * there.
 */
function NowCards({
  row,
  waves,
  hasWaves,
  sea,
  now,
  rated,
  facing,
  measured,
  next,
  onShowNext,
  forecast,
}: {
  row: SpotRow | null;
  /** The waves now, as the Waves section has them, or null with none. */
  waves: WaveRow | null;
  /** Whether the place has waves at all (water the open sea reaches). */
  hasWaves: boolean;
  sea: SpotSea | null;
  now: number;
  /** False at a point on the open water: no shore, so no stars. */
  rated: boolean;
  /** The way the shore faces, or null where it has none. */
  facing: number | null;
  /**
   * The paired station's latest reading, fresh (`measuredNow`), or null: the
   * card says it, and where it is from, in place of the forecast's.
   */
  measured: MeasuredReading | null;
  next: StarWindow | null;
  onShowNext: (time: number) => void;
  forecast: SpotForecast;
}) {
  const speed = useSpeed();
  const heights = useHeights();
  const s = styles();
  const wind = measured
    ? {
        kn: measured.reading.windKn,
        gust: measured.reading.gustKn,
        from: measured.reading.from,
      }
    : row?.hour.wind
      ? {
          kn: row.hour.wind.wind_kn,
          gust: row.hour.wind.gust_kn,
          from: row.hour.wind.direction_deg as number | null,
        }
      : null;
  const shore = measured ? measuredShore(measured, facing) : row?.shore;
  const gust = wind ? speed.gust(wind.kn, wind.gust) : null;
  const taken = row && !row.rating ? standIn(row) : null;
  const watered = (row?.water?.ids ?? [])
    .map((id) => forecast.water_quality.items.find((item) => item.id === id))
    .find((item) => item?.replaces_ratings);
  const stars = row?.rating?.stars ?? 0;
  const wing = row?.rating
    ? `${row.rating.wing.own ?? row.rating.wing.recommended} m² wing`
    : null;
  // No stars this hour: why, and when the next ones are (the time alone a
  // link), or that none are coming.
  const nextLine =
    !stars && !taken ? (
      next ? (
        <span className={s.nowNext()}>
          <span className={s.nowQuiet()}>Next</span>
          <Stars n={next.stars} size={13} />
          <Button
            variant="link"
            size="sm"
            className="max-w-full"
            onClick={() => onShowNext(next.from)}
            data-next-stars
          >
            {dayNames(dublinDate(next.from), now).short} {clock(next.from)}
          </Button>
        </span>
      ) : (
        <span className={s.nowLine()} data-next-stars>
          None ahead
        </span>
      )
    ) : stars > 0 && wing ? (
      <span className={s.nowLine()}>{wing}</span>
    ) : null;
  return (
    <>
      {rated && (
        <div
          className={s.nowCard({ className: s.nowCardStars() })}
          data-your-stars
        >
          <div className={s.nowHead()}>
            <span className={s.nowLabel()}>Stars now</span>
            <div className={s.nowFigure()}>
              {stars > 0 ? (
                <Stars n={stars} size={20} />
              ) : taken ? (
                <NoticeMark
                  level={taken.level}
                  className={s.nowWord({ className: "min-w-0" })}
                >
                  <span className="truncate">
                    {taken.level === "water" && watered
                      ? restrictionShort(watered)
                      : taken.word}
                  </span>
                </NoticeMark>
              ) : (
                <span className={s.nowWord()}>
                  {row && !row.hour.daylight ? "Dark" : "No stars"}
                </span>
              )}
            </div>
          </div>
          {nextLine}
        </div>
      )}
      <div className={s.nowCard()} data-now>
        <div className={s.nowHead()}>
          <span className={s.nowLabel()} data-now-wind-label>
            Wind now
            {measured && (
              <span className={s.roSource()} data-now-source>
                {" "}
                · {pairedName(measured.paired)},{" "}
                {measuredAt(measured.reading.time)}
              </span>
            )}
          </span>
          <div
            className={s.nowFigure()}
            data-now-wind
            data-measured={measured ? measured.paired.station.id : undefined}
          >
            {wind ? (
              <>
                {speed.say(wind.kn)}
                {gust !== null && (
                  <span className={s.nowGust()}>g{speed.say(gust)}</span>
                )}
                {speed.unit && (
                  <span className={s.nowUnit()}>{speed.unit}</span>
                )}
              </>
            ) : (
              "–"
            )}
          </div>
        </div>
        {wind && (
          <span
            className={s.nowLine({
              className: isOff(shore) ? s.off() : undefined,
            })}
            data-now-direction
          >
            {wind.from !== null && compass(wind.from)}
            {wind.from !== null && shoreWord(shore) && " · "}
            {shoreWord(shore)}
          </span>
        )}
      </div>
      {(hasWaves || sea) && (
        <div className={s.nowCard()} data-now-waves>
          <div className={s.nowHead()}>
            <span className={s.nowLabel()}>
              {hasWaves ? "Waves now" : "Water now"}
            </span>
            <div className={s.nowFigure()}>
              {hasWaves
                ? waves?.heightM == null
                  ? "–"
                  : heights.text(waves.heightM)
                : sea && `${sea.celsius.toFixed(1)} °C`}
            </div>
          </div>
          {hasWaves && (
            <span className={s.nowLine()}>
              {waves?.periodS != null && `${Math.round(waves.periodS)} s`}
              {waves?.from != null && ` ${compass(waves.from)}`}
              {sea && (
                <span
                  data-sea-temperature
                  title={`Measured ${observationAge((now - Date.parse(sea.time)) / 3600000)} at the ${sea.station} ${NETWORK_LABEL[sea.network as SeaTemperatureNetwork] ?? "station"}, ${sea.distance_km < 10 ? sea.distance_km.toFixed(1) : Math.round(sea.distance_km)} km from here`}
                >
                  {waves?.periodS != null || waves?.from != null ? " · " : ""}
                  water {sea.celsius.toFixed(1)} °C
                </span>
              )}
            </span>
          )}
        </div>
      )}
    </>
  );
}

/** Where a day or the next stars sends the week: that day, at that hour. */
interface WeekMove {
  day: number;
  at: number;
  /** The hour to hold, or null to stand at now. */
  time: number | null;
}

/** Keeps the chosen day in view along the strip, on opening and after. */
function useDayInView(dayAt: number) {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = strip.current;
    const card = row?.children[dayAt] as HTMLElement | undefined;
    if (!row || !card) return;
    // The strip is the card's offset parent: its window is laid over it.
    const left = card.offsetLeft;
    if (
      left < row.scrollLeft ||
      left + card.offsetWidth > row.scrollLeft + row.clientWidth
    )
      row.scrollLeft = left - (row.clientWidth - card.offsetWidth) / 2;
  }, [dayAt]);
  return strip;
}

function DayButton({
  card,
  rated,
  on,
  onClick,
}: {
  card: DayCard;
  /** False at a point on the open water: the day has no stars to show. */
  rated: boolean;
  on: boolean;
  onClick: () => void;
}) {
  const speed = useSpeed();
  const s = styles();
  const gid = `spark-${card.date}`;
  const pts = card.spark
    .filter((p) => p.hour >= 5 && p.hour <= 20)
    .map(
      (p) =>
        [
          ((p.hour - 5) / 15) * 100,
          26 - (Math.min(p.kn, 32) / 32) * 22,
        ] as const,
    );
  return (
    <button
      type="button"
      className={s.day()}
      aria-pressed={on}
      onClick={onClick}
      data-day-card={card.date}
    >
      <span className={s.dayName({ className: on ? s.dayOn() : undefined })}>
        {card.label}
        <span className={s.dayDate()}>{card.day}</span>
      </span>
      {card.notice && !card.best ? (
        <NoticeMark level={card.notice.level}>{card.notice.word}</NoticeMark>
      ) : !rated ? null : (
        <span className="inline-flex items-center gap-1.5">
          <Stars n={card.best} />
          {card.notice && (
            <>
              <NoticeMark level={card.notice.level} />
              <span className="sr-only">
                {card.notice.word}, no stars for some hours
              </span>
            </>
          )}
        </span>
      )}
      <span className={s.range()}>
        {card.lo === null || card.hi === null
          ? "–"
          : `${speed.say(card.lo)}–${speed.say(card.hi)}`}{" "}
        <span className={s.small()}>{speed.unit}</span>
      </span>
      <svg
        className={s.spark()}
        viewBox="0 0 100 26"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gid}>
            {card.spark
              .filter((p) => p.hour >= 5 && p.hour <= 20)
              .map((p, i) => (
                <stop
                  key={i}
                  offset={`${((p.hour - 5) / 15) * 100}%`}
                  stopColor={windCss(p.kn)}
                />
              ))}
          </linearGradient>
        </defs>
        {pts.length > 1 && (
          <path
            d={`${smoothPath(pts)}L100,26L0,26Z`}
            fill={`url(#${gid})`}
            fillOpacity={0.85}
          />
        )}
      </svg>
    </button>
  );
}

/**
 * The week graph is two sections on the same hours, Wind and then Waves, each
 * a stack of bands: its name, its height and the gap under it. The wind's
 * blend sits under its direction; a point on the water reads one model at a
 * time, so it has no blend. The stars' strip keeps its place without stars,
 * so the wind band starts where it always does.
 */
const WIND_BANDS = [
  ["stars", 8, 8],
  ["wind", 96, 6],
  ["dir", 40, 8],
  ["blend", 44, 10],
  ["sky", 28, 8],
  ["rain", 30, 8],
  ["tide", 60, 8],
  ["current", 38, 8],
] as const;
type WindBand = (typeof WIND_BANDS)[number][0];
const WIND_NAME: Record<WindBand, string> = {
  stars: "Stars",
  wind: "Wind",
  dir: "Direction",
  blend: "Models",
  sky: "Sky",
  rain: "Rain",
  tide: "Tide",
  current: "Current",
};

/**
 * The waves' bands: the blended height with the models' spread, where the
 * sea comes from with its height, its peak period, every wave model's own
 * line and the blend's, and then the swells and the wind sea, each a band
 * only where the lead model has it somewhere in the week.
 */
const WAVE_BANDS = [
  ["waves", 92, 12],
  ["wdir", 40, 4],
  ["period", 18, 14],
  ["wblend", 64, 12],
  ["swell1", 38, 12],
  ["swell2", 38, 12],
  ["swell3", 38, 12],
  ["windsea", 38, 14],
] as const;
type WaveBand = (typeof WAVE_BANDS)[number][0];
/** A swell or wind sea lower than this, in metres, reads as none. */
const MIN_TRAIN_M = 0.15;
const WAVE_NAME: Record<WaveBand, string> = {
  waves: "Waves",
/** Past the lead model's split: its absence is not a calm sea. */
const NO_SWELL_SPLIT = "Swell split not forecast this far ahead";
  wdir: "Direction",
  period: "Period",
  wblend: "Models",
  ...(Object.fromEntries(PART_ROWS) as Record<PartRow, string>),
};

interface Stack<K extends string> {
  at: Partial<Record<K, readonly [number, number]>>;
  /** Where the hours run along the foot. */
  axis: number;
  height: number;
}

/** Where each band of a section sits, the hours' axis under the last, and the height. */
function stack<K extends string>(
  bands: readonly (readonly [K, number, number])[],
  top: number,
  keep: (band: K) => boolean,
): Stack<K> {
  const at: Partial<Record<K, readonly [number, number]>> = {};
  let y = top;
  let gap = 0;
  for (const [band, h, g] of bands) {
    if (!keep(band)) continue;
    at[band] = [y, h];
    y += h + g;
    gap = g;
  }
  const axis = y - gap + 8;
  return { at, axis, height: axis + 22 };
}

/** An arrow pointing up, turned to a bearing: the wind's, the sea's, the water's. */
const ARROW = "M0 6V-6M-3.5 -2.5L0 -6.5l3.5 4";

/**
 * The models whose lines are dashed as well as coloured: the global ones.
 * Several lines in one band all cross, and two hues side by side (ECMWF's
 * purple, ICON-EU's blue) are too close for a colour-blind rider, so the
 * coarse global models are dashed and the fine regional ones solid; every
 * value is named in the label and the key besides.
 */
const DASHED = new Set([
  "ecmwf",
  "gfs",
  "aifs",
  "ecmwf-ens",
  "gefs",
  "icon",
  "arpege",
  "gfs-wave",
  "ecmwf-wave",
]);
const DASH = "5 3";

/**
 * Each wave model's own colour in the wave blend (ui/theme.css): five hues
 * told apart side by side on both themes, the global two also dashed. A
 * model with no colour of its own yet is drawn in the second ink.
 */
const WAVE_HUE: Record<string, { stroke: string; fill: string }> = {
  "met-office-wave": {
    stroke: "stroke-wave-met-office",
    fill: "fill-wave-met-office",
  },
  "ibi-wave": { stroke: "stroke-wave-ibi", fill: "fill-wave-ibi" },
  "mi-swan": { stroke: "stroke-wave-swan", fill: "fill-wave-swan" },
  "gfs-wave": { stroke: "stroke-wave-gfs", fill: "fill-wave-gfs" },
  "ecmwf-wave": { stroke: "stroke-wave-ecmwf", fill: "fill-wave-ecmwf" },
};
const waveHue = (id: string) =>
  WAVE_HUE[id] ?? { stroke: "stroke-ink-2", fill: "fill-ink-2" };

/** A wave model's name, as Settings and the layers list give it. */
const waveModelName = (id: string) =>
  id === WAVE_BLEND
    ? "Blend"
    : (modelEntry(id)?.name ?? (id === "ibi-wave" ? "Copernicus IBI" : id));
/** Where a wave model's run is said to end, on its line: "Met Office ends". */
const waveEndName = (id: string) => waveModelName(id).replace(/ Wave$/, "");

/** Whether the page is laid out for a desktop (the theme's `wide`), kept current. */
function useWide() {
  const query = "(min-width: 45rem)";
  const [wide, setWide] = useState(() =>
    typeof matchMedia === "undefined" ? true : matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const list = matchMedia(query);
    const changed = () => setWide(list.matches);
    changed();
    list.addEventListener("change", changed);
    return () => list.removeEventListener("change", changed);
  }, []);
  return wide;
}

type Section = "wind" | "waves";

/** A day's night, before its first light and after its last, as time spans. */
const nightSpans = (sun: DaySun, midnight: number) =>
  [
    ...(sun.firstLight ? [[midnight, sun.firstLight] as const] : []),
    ...(sun.lastLight ? [[sun.lastLight, midnight + 24 * HOUR] as const] : []),
  ] as const;

function Graph({
  rows,
  days,
  now,
  turns,
  bed,
  depthAt,
  onFocus,
  backToNow,
  scrollTo,
  opening,
  dark,
  rider,
  rated,
  models,
  blend,
  waves,
  waveModel,
  current,
  rain,
  measured = null,
  nowMeasured = null,
  strip,
  dayWindow,
  arrowsAt,
  switcher,
}: {
  rows: SpotRow[];
  days: { day: { date: string }; sun: DaySun; midnight: number }[];
  now: number;
  turns: ReturnType<typeof tideTurns>;
  bed: LaunchBed | null;
  depthAt: (t: number) => number | null;
  onFocus: (t: number | null) => void;
  /** Changes when the top of the page lets go of the hour picked here. */
  backToNow: number;
  scrollTo: WeekMove | null;
  /** The row the address opens on (`?at=`), held as a pointer would hold it. */
  opening: number | null;
  /**
   * Which rows are after dark, where the rider hides them (Settings); null
   * where the night is shown, shaded.
   */
  dark: readonly boolean[] | null;
  rider: Rider;
  /** False at a point on the open water: no stars, so no star row or tint. */
  rated: boolean;
  /** The models the rider blends, each its own wind (`modelSeries`). */
  models: readonly ModelSeries[];
  /** Their blend at each row's time (`windBlend`). */
  blend: ReadonlyMap<number, WindBlendAt>;
  /**
   * The week's sea (`waveWeek`), or null where the Waves section is not
   * shown: sheltered water, which the open sea's waves do not reach, or no
   * wave model at all.
   */
  waves: WaveWeek | null;
  /** The rider's wave model, or null for the finest at each hour. */
  waveModel: string | null;
  current: SpotCurrents;
  /** The rain in each hour, mm/h, by the hour's time (`rainPerHour`). */
  rain: ReadonlyMap<number, number>;
  /**
   * The weather station or buoy paired with the place (force5/src/windObs.ts
   * `pairStation`), or null: its readings up to now are drawn on the wind,
   * and its latest is what the label and a phone's tag say at Now.
   */
  measured?: Paired | null;
  /** Its latest reading, while fresh (`measuredNow`): said at Now. */
  nowMeasured?: MeasuredReading | null;
  /** The strip of days, whose days in view the graph marks. */
  strip: React.RefObject<HTMLDivElement | null>;
  /** The outline on that strip round the days in view. */
  dayWindow: React.RefObject<HTMLDivElement | null>;
  /** Where the arrows go, at the strip's end. */
  arrowsAt: HTMLDivElement | null;
  /** The Graph | Table switch, beside the Wind section's title. */
  switcher: React.ReactNode;
}) {
  const speed = useSpeed();
  const heights = useHeights();
  const units = useContext(UnitsContext);
  const s = styles();
  const [ref, width] = useWidth<HTMLDivElement>(900);
  const waveRef = useRef<HTMLDivElement>(null);
  // The days along the head of each graph, on the same hours as the graphs.
  const heads = useRef<HTMLDivElement>(null);
  const waveHeads = useRef<HTMLDivElement>(null);
  const windSvg = useRef<SVGSVGElement>(null);
  const waveSvg = useRef<SVGSVGElement>(null);
  const wide = useWide();
  const [hover, setHover] = useState<number | null>(opening);
  // An hour clicked on, or stepped to with the arrow keys, is held: the
  // pointer moving across the graph leaves it where it is, and the hour read
  // out stays, until it is let go (`release`).
  const [pinned, setPinned] = useState<number | null>(null);
  // The keyboard is in the graph: its focus ring stands on the cursor's tag.
  const [keyFocus, setKeyFocus] = useState(false);
  const release = () => {
    setPinned(null);
    setHover(null);
    setCard(null);
  };
  useEffect(
    () => onFocus(hover === null ? null : (rows[hover]?.time ?? null)),
    [hover, rows, onFocus],
  );
  const gbox = useRef<HTMLDivElement>(null);
  const waveBox = useRef<HTMLDivElement>(null);
  // Which graph says the hour on a desktop, where one tag does: the one the
  // pointer is over, or the keys are in; a phone says it on both.
  const [tagAt, setTagAt] = useState<Section>("wind");
  const lower = stack(WIND_BANDS, RAIL, (band) =>
    band === "blend" ? models.length > 0 : true,
  );
  const GH = lower.height;
  const ROW = lower.at as Record<WindBand, readonly [number, number]>;
  // The hours start where the wind does: the first hour any model has, or
  // now if that is still to come. Today's earlier hours have no forecast
  // to draw, and a blank stretch is not worth a scroll.
  const firstWind = rows.find((r) => r.hour.wind)?.time ?? null;
  const dayStart = days[0]?.midnight ?? now;
  const nowHour = rowAt(rows, now)?.time ?? now;
  const start =
    firstWind === null
      ? dayStart
      : Math.max(dayStart, Math.min(firstWind, nowHour));
  const end = (days.at(-1)?.midnight ?? now) + 24 * HOUR;
  // The graph's timeline: the days end to end, or with the night hidden
  // each day's lit hours alone, the days joined side by side
  // (shared/web/afterDark.ts). Every x along the graph is a place on it.
  const line = useMemo<Fold>(
    () =>
      dark
        ? fold(
            keptSpans(rows, dark)
              .map((span) => ({
                from: Math.max(start, span.from),
                to: Math.min(end, span.to),
              }))
              .filter((span) => span.to > span.from),
          )
        : unfolded(start, end),
    [dark, rows, start, end],
  );
  /** Whether a row is drawn: all of them, or those before dark alone. */
  const seen = (r: Pick<SpotRow, "time">) =>
    r.time >= start && (!dark || line.kept(r.time));
  /** Where a line through the hours breaks: across a night left out. */
  const apart = useMemo(() => {
    if (!dark) return () => false;
    const spanOf = (t: number) =>
      line.spans.findIndex((span) => t >= span.from && t < span.to);
    return (a: number, b: number) => spanOf(a) !== spanOf(b);
  }, [dark, line]);
  const hours = line.length / HOUR;
  /** Hours between the figures along the foot. */
  const tick = dark ? 3 : 6;
  const daysShown =
    width < 600 ? 0 : Math.max(3, Math.min(7, Math.floor(width / 340)));
  // A day's width on a desktop is a day's hours, the lit ones alone where
  // the night is hidden.
  const dayHours = dark ? hours / Math.max(1, line.spans.length) : 24;
  const px = width < 600 ? 18 : width / (daysShown * dayHours);
  const W = Math.max(width, hours * px);
  const X = (t: number) => (line.at(t) / HOUR) * px;
  /**
   * Whether a day has any of the graph: with the night left out, a day whose
   * light is all gone (tonight, the page opened after dark) has none, and
   * no name or line of its own.
   */
  const drawn = (midnight: number) =>
    !dark || X(midnight + 24 * HOUR) - X(midnight) >= 1;
  // The two sections' hours scroll as one, so an hour reads straight down
  // both. The one the rider moves (`driver`) leads; the other follows it,
  // and never the other way, so a finger's fling is not fought.
  const driver = useRef<HTMLDivElement | null>(null);
  const drove = useRef(-Infinity);
  const scrollers = () =>
    [ref.current, waveRef.current, heads.current, waveHeads.current].filter(
      (el): el is HTMLDivElement => el !== null,
    );
  const drive = (e: { currentTarget: HTMLDivElement }) => {
    driver.current = e.currentTarget;
  };
  useEffect(() => {
    if (!scrollTo || !ref.current) return;
    driver.current = ref.current;
    const row = scrollTo.time === null ? null : rowIndexAt(rows, scrollTo.time);
    // Sent to a day, or to the next stars: it reads that hour, and the
    // pointer takes it from there; nothing is held.
    setPinned(null);
    if (row !== null) setHover(row);
    ref.current.scrollTo({
      left:
        phone && row !== null
          ? Math.max(0, leftFor(mid(rows[row])))
          : X(days[scrollTo.day]?.midnight ?? start),
      behavior: "smooth",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTo]);
  // On a phone the hours are scrolled, not pointed at: a playhead stands in
  // the graph and the hour under it is the one read out. It rides in from
  // the left edge over the first half screen of scrolling, holds in the
  // middle, and rides out to the right edge over the last, so every hour
  // can be put under it.
  const phone = width < 600;
  // How far the hours are scrolled on a phone, where a note whose line has
  // gone off the left edge would be cut in two: it goes with its line.
  const [scrolled, setScrolled] = useState(0);
  // Nothing is drawn before the first hour, so on a phone the hours start
  // there, at the screen's left, and not half a screen of empty graph in.
  const firstX = phone
    ? Math.max(0, X(Math.min(rows[0]?.time ?? now, now)) - 8)
    : 0;
  const span = W - firstX;
  const reach = span - width;
  const headAt = (scrolled: number) => {
    const left = Math.max(0, scrolled - firstX);
    return (
      firstX +
      (reach < width
        ? (left / Math.max(1, reach)) * span
        : left < width / 2
          ? 2 * left
          : left > reach - width / 2
            ? 2 * left - reach + width
            : left + width / 2)
    );
  };
  const leftFor = (at: number) => {
    const x = Math.max(0, at - firstX);
    return (
      firstX +
      (reach < width
        ? (x / span) * reach
        : x < width
          ? x / 2
          : x > reach
            ? (x + reach - width) / 2
            : x - width / 2)
    );
  };
  const rowAtX = (x: number) => {
    const t = line.time((x / px) * HOUR);
    let at = rows.findIndex(seen);
    rows.forEach((r, i) => {
      if (r.time <= t && seen(r)) at = i;
    });
    return Math.max(0, at);
  };
  const mid = (r: Pick<SpotRow, "time" | "step">) =>
    X(r.time) + (r.step * px) / 2;
  useEffect(() => {
    const opened = opening === null ? null : rows[opening];
    const left = phone
      ? // The hour the address opens on, else now, under the playhead.
        Math.max(0, leftFor(opened ? mid(opened) : X(now)))
      : // The hour the address opens on, a third of the way in, as the
        // hours before it are worth a glance; else now, an hour in: the
        // morning is a scroll back.
        Math.max(0, opened ? X(opened.time) - width / 3 : X(now) - px);
    for (const el of scrollers()) el.scrollLeft = left;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [px, !!waves]);
  // With a mouse the hour read out is the one under the pointer, and stays
  // so as a wheel or a trackpad scrolls the hours along under it. Over a
  // section, a card beside the pointer lists that section's models.
  const pointer = useRef<{
    section: Section;
    x: number;
    y: number;
  } | null>(null);
  const [card, setCard] = useState<{
    section: Section;
    band: string;
    left: number;
    top: number;
    /** Laid to the left of the hour, out of the way of the graph's edge. */
    flip: boolean;
  } | null>(null);
  /** A section's bands, top to bottom, each with its place. */
  const bandsOf = (at: Section) => {
    const stacked: Partial<Record<string, readonly [number, number]>> =
      at === "wind" ? lower.at : (waveStack?.at ?? {});
    return Object.entries(stacked) as [string, readonly [number, number]][];
  };
  /** The band a height in a section's graph falls in, or the nearest to it. */
  const bandAt = (at: Section, y: number) => {
    let best: string | null = null;
    let distance = Infinity;
    for (const [band, [top, h]] of bandsOf(at)) {
      const off = y < top ? top - y : y > top + h ? y - (top + h) : 0;
      if (off < distance) {
        distance = off;
        best = band;
      }
    }
    return best;
  };
  /**
   * The label's place: beside the hour's column, level with the band under
   * the pointer, or to its left where the column is near the graph's edge.
   */
  const placeBand = (at: Section, row: number, band: string) => {
    const box = (at === "wind" ? gbox : waveBox).current;
    const svg = (at === "wind" ? windSvg : waveSvg).current;
    const r = rows[row];
    const span = bandsOf(at).find(([name]) => name === band)?.[1];
    if (!box || !svg || !r || !span) return null;
    const b = box.getBoundingClientRect();
    const v = svg.getBoundingClientRect();
    const right = v.left + X(r.time) + r.step * px - b.left;
    const flip = right + LABEL_GAP + LABEL_WIDTH > b.width - 8;
    const middle = v.top + span[0] + span[1] / 2 - b.top;
    return {
      section: at,
      band,
      left: flip ? v.left + X(r.time) - b.left - LABEL_GAP : right + LABEL_GAP,
      top: Math.max(4, Math.min(middle, b.height - 20)),
      flip,
    };
  };
  const place = (at: Section, row: number, y: number) => {
    const svg = (at === "wind" ? windSvg : waveSvg).current;
    if (!svg) return null;
    const band = bandAt(at, y - svg.getBoundingClientRect().top);
    return band === null ? null : placeBand(at, row, band);
  };
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    // A section scrolled a moment after the other last moved is following
    // it; one scrolled after a pause is being moved itself, and leads.
    const at = performance.now();
    if (el !== driver.current && at - drove.current > 150) driver.current = el;
    if (el === driver.current) {
      drove.current = at;
      for (const other of scrollers())
        if (other !== el && other.scrollLeft !== el.scrollLeft)
          other.scrollLeft = el.scrollLeft;
    }
    setScrolled(el.scrollLeft);
    paintDayWindow(el.scrollLeft);
    if (phone) {
      const row = rowAtX(headAt(el.scrollLeft));
      setHover(row);
      setCard((was) =>
        was ? (placeBand(was.section as Section, row, was.band) ?? was) : was,
      );
    } else if (pointer.current) {
      const row =
        pinned ??
        rowAtX(
          pointer.current.x -
            el.getBoundingClientRect().left -
            el.clientLeft +
            el.scrollLeft,
        );
      if (pinned === null) setHover(row);
      if (wide) setCard(place(pointer.current.section, row, pointer.current.y));
    }
  };
  /**
   * Where the days in view stand on the strip: the outline round them, always
   * whole cards, a sliver of a day at the graph's edge not counted.
   */
  const paintDayWindow = (left: number) => {
    const frame = dayWindow.current;
    const row = strip.current;
    if (!frame || !row) return;
    const tiles = [...row.querySelectorAll<HTMLElement>("[data-day-card]")];
    const showing = days.map(({ midnight }) => {
      const from = X(midnight);
      const to = X(midnight + 24 * HOUR);
      const kept = Math.min(to, left + width) - Math.max(from, left);
      return kept >= Math.min(WHOLE_DAY_PX, to - from - 1);
    });
    const first = showing.indexOf(true);
    const last = showing.lastIndexOf(true);
    const a = tiles[first]?.offsetLeft;
    const end = tiles[last];
    if (a === undefined || !end) return;
    const b = end.offsetLeft + end.offsetWidth;
    frame.style.left = `${a}px`;
    frame.style.width = `${Math.max(0, b - a)}px`;
    // The hours moved past what the strip shows: the strip follows.
    if (a < row.scrollLeft) row.scrollLeft = a;
    else if (b > row.scrollLeft + row.clientWidth)
      row.scrollLeft = b - row.clientWidth;
  };
  useEffect(
    () => paintDayWindow(ref.current?.scrollLeft ?? 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [px, width, days.length, rows.length, dark],
  );
  /** One day on or back: to a day's start, past the hours in view. */
  const stepDay = (by: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    driver.current = el;
    const list = days.filter(({ midnight }) => drawn(midnight));
    const at = el.scrollLeft;
    const target =
      by > 0
        ? list.find(({ midnight }) => X(midnight) > at + 2)
        : [...list].reverse().find(({ midnight }) => X(midnight) < at - 2);
    if (target) el.scrollTo({ left: X(target.midnight), behavior: "smooth" });
  };
  // Press and pull to scroll, on a mouse: past a few pixels it is a drag, and
  // lets the click that follows go, so a click still holds an hour.
  const pressed = useRef<{ dragged: boolean } | null>(null);
  const pressHours = (e: React.PointerEvent<HTMLDivElement>) => {
    driver.current = e.currentTarget;
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = e.currentTarget;
    const startX = e.clientX;
    const startLeft = el.scrollLeft;
    const press = { dragged: false };
    pressed.current = press;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!press.dragged && Math.abs(dx) < 4) return;
      press.dragged = true;
      el.scrollLeft = startLeft - dx;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.setTimeout(() => {
        pressed.current = null;
      }, 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const windRows = rows.filter((r) => r.hour.wind && seen(r));
  const [wy, wh] = ROW.wind;
  const Y = (k: number) => wy + wh - (Math.min(k, 36) / 36) * wh;
  /** Hours in runs, each broken where a night is left out between two. */
  const runs = <T extends { time: number }>(items: readonly T[]): T[][] => {
    const out: T[][] = [];
    items.forEach((item, i) => {
      if (!i || apart(items[i - 1].time, item.time)) out.push([]);
      out.at(-1)!.push(item);
    });
    return out.filter((run) => run.length > 1);
  };
  /** A line through each run, and the area under each down to `base`. */
  const traced = <T extends { time: number }>(
    items: readonly T[],
    at: (item: T) => readonly [number, number],
    base: number,
  ) => {
    const lines = runs(items).map((run) => run.map(at));
    return {
      line: lines.map(smoothPath).join(""),
      area: lines
        .map(
          (pts) =>
            `${smoothPath(pts)}L${pts.at(-1)![0]},${base}L${pts[0][0]},${base}Z`,
        )
        .join(""),
    };
  };
  /** The band between a low and a high through each run. */
  const between = <T extends { time: number }>(
    items: readonly T[],
    low: (item: T) => readonly [number, number],
    high: (item: T) => readonly [number, number],
  ) =>
    runs(items)
      .map((run) => {
        const top = run.map(high);
        const bot = run.map(low).reverse();
        return `${smoothPath(top)}L${smoothPath(bot).slice(1)}Z`;
      })
      .join("");
  const mean = traced(
    windRows,
    (r) => [mid(r), Y(r.hour.wind!.wind_kn)],
    wy + wh,
  );
  const spread = between(
    windRows,
    (r) => [mid(r), Y(r.hour.wind!.min_kn)],
    (r) => [mid(r), Y(r.hour.wind!.max_kn)],
  );
  const gust = traced(
    windRows.filter((r) => r.hour.wind!.gust_kn !== null),
    (r) => [mid(r), Y(r.hour.wind!.gust_kn!)],
    wy + wh,
  ).line;
  // The wind measured at the paired station, hour by hour up to now, where
  // the graph's hours are: each reading is the mean of the hour that ends
  // at its time, so it is drawn at that hour's middle, never past now. A
  // line through each run of hours, broken where one is missing.
  const readings = measured
    ? measured.station.readings.filter(
        (r) => r.time > start && r.time <= now && seen(r),
      )
    : [];
  const rx = (r: WindReading) => X(r.time - HOUR / 2);
  const measuredLine = readings
    .reduce<WindReading[][]>((out, r, i) => {
      const prev = readings[i - 1];
      if (!prev || r.time - prev.time > HOUR || apart(prev.time, r.time))
        out.push([]);
      out.at(-1)!.push(r);
      return out;
    }, [])
    .filter((run) => run.length > 1)
    .map((run) => smoothPath(run.map((r) => [rx(r), Y(r.windKn)] as const)))
    .join("");
  const [ty, th] = ROW.tide;
  const tideMax = Math.max(4.5, ...turns.map((t) => t.height)) + 0.3;
  const TY = (m: number) => ty + th - (m / tideMax) * (th - 6);
  const curve = traced(
    tideCurve(turns, start, end, 30).filter(seen),
    (p) => [X(p.time), TY(p.height)],
    ty + th,
  );
  const deepAt =
    bed && Number.isFinite(bed.z) && !bed.area.level ? bed.z + 1 : null;
  const handovers = leadChanges(rows);
  const ay = lower.axis;
  const hoverRow = hover === null ? null : rows[hover];
  useEffect(() => {
    if (!backToNow) return;
    release();
    if (phone) for (const el of scrollers()) el.scrollLeft = leftFor(X(now));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backToNow]);
  // Now, or with the night left out and now in it, the next first light.
  const nowRow = useMemo(() => {
    const row = rowAt(rows, now);
    if (!dark || !row || seen(row)) return row;
    return rows.find((r) => r.time > row.time && seen(r)) ?? row;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, now, dark, line]);
  const shownRow = hoverRow ?? nowRow;
  const shownAt = shownRow ? rows.indexOf(shownRow) : -1;
  const onMove = (at: Section) => (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "touch") return;
    pointer.current = { section: at, x: e.clientX, y: e.clientY };
    setTagAt(at);
    const box = e.currentTarget.getBoundingClientRect();
    const row = pinned ?? rowAtX(e.clientX - box.left);
    if (pinned === null) setHover(row);
    if (wide) setCard(place(at, row, e.clientY));
  };
  const onLeave = () => {
    pointer.current = null;
    setCard(null);
    setHover(pinned);
  };
  /** A click holds the hour under the pointer; a click on it lets it go. */
  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (pressed.current?.dragged) return;
    const box = e.currentTarget.getBoundingClientRect();
    const row = rowAtX(e.clientX - box.left);
    if (!seen(rows[row])) return;
    setPinned((was) => (was === row ? null : row));
    setHover(row);
  };
  /**
   * The arrow keys step the hour, a day with Shift, and hold it; up and down
   * move the label through the rows; Home goes back to now, Esc lets go.
   */
  const keyBand = useRef<Partial<Record<Section, number>>>({});
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      if (pinned === null) return;
      e.preventDefault();
      release();
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      release();
      const left = phone ? leftFor(X(now)) : Math.max(0, X(now) - px);
      for (const el of scrollers()) el.scrollLeft = left;
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const at: Section =
        e.currentTarget === waveRef.current ? "waves" : "wind";
      const bands = bandsOf(at);
      if (!bands.length || shownAt < 0) return;
      e.preventDefault();
      const was =
        keyBand.current[at] ?? (e.key === "ArrowDown" ? -1 : bands.length);
      const next = Math.max(
        0,
        Math.min(bands.length - 1, was + (e.key === "ArrowDown" ? 1 : -1)),
      );
      keyBand.current[at] = next;
      if (wide) setCard(placeBand(at, shownAt, bands[next][0]));
      return;
    }
    const by = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!by) return;
    e.preventDefault();
    const from = shownAt < 0 ? rows.findIndex(seen) : shownAt;
    let next = from;
    for (let n = e.shiftKey ? 24 : 1; n > 0;) {
      const i = next + by;
      if (i < 0 || i >= rows.length) break;
      next = i;
      if (seen(rows[i])) n -= rows[i].step;
    }
    while (next !== from && !seen(rows[next])) next -= by;
    const row = rows[next];
    if (!row) return;
    driver.current = e.currentTarget;
    if (phone) {
      e.currentTarget.scrollLeft = leftFor(mid(row));
      return;
    }
    setPinned(next);
    setHover(next);
    if (wide && card)
      setCard(placeBand(card.section as Section, next, card.band));
    const el = e.currentTarget;
    const x = X(row.time);
    if (
      x < el.scrollLeft + 40 ||
      x + row.step * px > el.scrollLeft + width - 40
    )
      el.scrollLeft = Math.max(0, x - width / 3);
  };
  // Now is said as now, however it came to be under the playhead.
  // Not with the night left out and now in it: then the hour read out is
  // the next first light's, and said by its time.
  const isNow = shownRow === rowAt(rows, now);
  const hourWords =
    isNow || !shownRow
      ? "Now"
      : `${dayNames(dublinDate(shownRow.time), shownRow.time).short} ${clock(shownRow.time)}`;
  const heldHere = pinned !== null && hover === pinned;
  const letGo = (
    <Button
      variant="quiet"
      size="xs"
      icon
      className={s.letGo()}
      aria-label="Let go of this hour"
      onClick={release}
      data-let-go
    >
      <Cross size={11} strokeWidth={2.5} aria-hidden="true" />
    </Button>
  );
  // The tag on the cursor: the hour under it, or with the keys in the graph
  // the hour read out, so the focus always has somewhere to stand. A phone
  // has no pointer, so its tag always stands at the playhead.
  const tagRow = phone
    ? (hoverRow ?? shownRow)
    : (hoverRow ?? (keyFocus ? shownRow : null));
  const tagWords = tagRow
    ? tagRow === rowAt(rows, now)
      ? "Now"
      : `${dayNames(dublinDate(tagRow.time), tagRow.time).short} ${clock(tagRow.time)}`
    : "";
  const waveAt = waves && shownAt >= 0 ? waves.rows[shownAt] : null;
  /** A phone's tag says the row's reading after its hour: the wind or the waves. */
  const tagReading = (at: Section, r: SpotRow): string => {
    if (at === "waves") {
      const w = waves?.rows[rows.indexOf(r)];
      if (!w || w.heightM === null) return "";
      return `${heights.text(w.heightM)}${w.periodS !== null ? ` ${Math.round(w.periodS)} s` : ""}`;
    }
    const atNow = r === rowAt(rows, now) ? nowMeasured : null;
    const kn = atNow ? atNow.reading.windKn : r.hour.wind?.wind_kn;
    if (kn === undefined) return "";
    const raw = atNow ? atNow.reading.gustKn : (r.hour.wind?.gust_kn ?? null);
    const gusting = speed.gust(kn, raw);
    return `${speed.say(kn)}${gusting !== null ? ` g${speed.say(gusting)}` : ""} ${speed.unit}`.trim();
  };
  /** The night shaded and hatched, the day lines and the hours along a section's foot. */
  const hatch = phone ? 6 : 8;
  const frame = (height: number, axis: number, data: boolean) => (
    <>
      <defs>
        {/* Parallel lines rising to the right, faint, at the Night key's
            spacing: drawn with the night, under everything else. */}
        <pattern
          id={`night-hatch-${data ? "wind" : "waves"}`}
          width={hatch}
          height={hatch}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1={hatch / 2}
            x2={hatch / 2}
            y1={0}
            y2={hatch}
            className="stroke-night-hatch"
            strokeWidth={1}
          />
        </pattern>
      </defs>
      {/* The night, shaded and hatched each side of a day's light; with the
          night left out, none of it, and the line between two days is where
          it was. */}
      {days.map(({ sun, midnight }, i) => (
        <g key={i}>
          {!dark &&
            nightSpans(sun, midnight).map(([from, to]) => (
              <g key={from}>
                <rect
                  x={X(from)}
                  y={0}
                  width={X(to) - X(from)}
                  height={height - 22}
                  className="fill-night"
                  data-night={data || undefined}
                />
                <rect
                  x={X(from)}
                  y={0}
                  width={X(to) - X(from)}
                  height={height - 22}
                  fill={`url(#night-hatch-${data ? "wind" : "waves"})`}
                />
              </g>
            ))}
          {i > 0 && drawn(midnight) && X(midnight) > 0 && (
            <line
              x1={X(midnight)}
              x2={X(midnight)}
              y1={0}
              y2={height}
              className="stroke-line"
              data-day-line={data || undefined}
            />
          )}
        </g>
      ))}
      {/* The hours along the foot: every sixth, or with the night left
          out every third; the days' names are in the head. */}
      {Array.from(
        { length: Math.ceil((end - dayStart) / HOUR / tick) },
        (_, i) => dayStart + i * tick * HOUR,
      )
        .filter(
          (t) =>
            t >= start &&
            dublinHour(t) % 24 !== 0 &&
            (!dark ||
              line.spans.some((span) => t >= span.from && span.to - t >= HOUR)),
        )
        .map((t) => (
          <text
            key={t}
            x={X(t)}
            y={axis + 14}
            textAnchor="middle"
            className="fill-ink-muted font-body text-caption"
          >
            {String(dublinHour(t)).padStart(2, "0")}
          </text>
        ))}
    </>
  );
  /** Now's line, and the hour read out's column, cursor and hold. */
  const marks = (axis: number) => (
    <>
      <line
        x1={X(now)}
        x2={X(now)}
        y1={4}
        y2={axis}
        className="stroke-now-marker"
        strokeWidth={1.5}
        data-now-line
      />
      {hoverRow && (
        <>
          {!phone && (
            <rect
              x={X(hoverRow.time)}
              y={4}
              width={hoverRow.step * px}
              height={axis - 4}
              rx={Math.min(6, px / 2)}
              className="fill-ink"
              fillOpacity={0.07}
            />
          )}
          <line
            x1={mid(hoverRow)}
            x2={mid(hoverRow)}
            y1={4}
            y2={axis}
            className="stroke-ink"
            strokeOpacity={phone ? 0.5 : 0.75}
            strokeWidth={phone ? 1.5 : 1}
            data-playhead-line={phone || undefined}
            data-cursor-line={!phone || undefined}
          />
          {heldHere && (
            <rect
              x={X(hoverRow.time) + 0.75}
              y={4.75}
              width={Math.max(1, hoverRow.step * px - 1.5)}
              height={axis - 5.5}
              rx={Math.min(6, px / 2)}
              className="fill-none stroke-ink"
              strokeWidth={1.5}
              data-held-hour
            />
          )}
        </>
      )}
    </>
  );
  const waveStack = waves
    ? stack(WAVE_BANDS, RAIL - 4, (band) =>
        // A train that stays under this all week has no row of its own.
        band in WAVE_PART
          ? waves.rows.some(
              (r) => (partOf(r, band as PartRow)?.heightM ?? 0) >= MIN_TRAIN_M,
            )
          : true,
      )
    : null;
  // Where the rows of the swells have run out of forecast, scrolled past their
  // last hour: said once, at the first such row.
  const partsEnded = (() => {
    const first = PART_ROWS.map(([key]) => waveStack?.at[key]).find(Boolean);
    if (!waves || !first) return null;
    const last = rows.reduce(
      (latest, r, i) =>
        PART_ROWS.some(([key]) => partOf(waves.rows[i], key)) ? r.time : latest,
      -Infinity,
    );
    if (last === -Infinity || scrolled + width * 0.25 <= X(last)) return null;
    return first[0] + 2;
  })();
  /** Whether a time is in a night that is drawn: its figures get a halo. */
  const halo = (t: number) =>
    !dark &&
    days.some(({ sun, midnight }) =>
      nightSpans(sun, midnight).some(([a, b]) => t >= a && t < b),
    )
      ? "halo"
      : "";
  /** What the label says for a row of the Wind section at the hour. */
  const windLabel = (band: WindBand, r: SpotRow): React.ReactNode => {
    if (band === "stars") {
      const taken = r.rating ? null : standIn(r);
      if (r.rating?.stars)
        return (
          <span className={s.hourLabelLine()}>
            <Stars n={r.rating.stars} size={12} />
            <span className={s.hourLabelQuiet()}>
              wing {r.rating.wing.own ?? r.rating.wing.recommended} m²
            </span>
          </span>
        );
      if (taken)
        return <NoticeMark level={taken.level}>{taken.word}</NoticeMark>;
      return (
        <span className={s.hourLabelQuiet()}>
          {r.rating?.reasons[0] ??
            (r.hour.daylight ? "No stars" : dark ? "Twilight" : "Dark")}
        </span>
      );
    }
    if (band === "wind" || band === "dir") {
      const atNow = r === rowAt(rows, now) ? nowMeasured : null;
      const w = r.hour.wind;
      const kn = atNow ? atNow.reading.windKn : w?.wind_kn;
      if (kn === undefined)
        return <span className={s.hourLabelQuiet()}>No wind reading</span>;
      const raw = atNow ? atNow.reading.gustKn : (w?.gust_kn ?? null);
      const from = atNow ? atNow.reading.from : (w?.direction_deg ?? null);
      const shownGust = speed.gust(kn, raw);
      const factor = w ? gustReading(w.wind_kn, w.gust_kn, rider) : null;
      return (
        <>
          <span className={s.hourLabelLine()}>
            {from !== null && (
              <svg
                width={12}
                height={12}
                viewBox="-8 -8 16 16"
                aria-hidden="true"
              >
                <path
                  d={ARROW}
                  transform={`rotate(${from + 180})`}
                  className="fill-none stroke-ink"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            <b className="font-semibold">
              {speed.say(kn)}
              {shownGust !== null && (
                <span className="text-gust-ink"> g{speed.say(shownGust)}</span>
              )}{" "}
              {speed.unit}
            </b>
            {from !== null && (
              <span className={s.hourLabelQuiet()}>{compass(from)}</span>
            )}
          </span>
          {!atNow && factor && (
            <span className={s.hourLabelQuiet()} data-card-gust-factor>
              Gust factor {factor.text}
              {rated && factor.kind !== "fine"
                ? `, ${GUST_WORDS[factor.kind]}`
                : ""}
            </span>
          )}
        </>
      );
    }
    if (band === "blend") {
      const b = blend.get(r.time);
      return (
        <>
          {models.map((m) => {
            const p = m.points.find((q) => q.time === r.time);
            return p ? (
              <span
                key={m.id}
                className={s.hourLabelModel()}
                data-card-model={m.id}
              >
                <ModelMark wind={m.id} />
                {modelName(m.id)}
                <b className="ml-auto font-semibold">
                  {`${speed.say(p.kn)} ${speed.unit}`.trim()}
                </b>
              </span>
            ) : null;
          })}
          {models.length > 1 && b && (
            <span className={s.hourLabelModel()} data-card-model="blend">
              <ModelMark blend />
              Blend
              <b className="ml-auto font-semibold">
                {`${speed.say(b.kn)} ${speed.unit}`.trim()}
              </b>
            </span>
          )}
        </>
      );
    }
    if (band === "sky") {
      const w = r.hour.weather;
      return (
        <span className={s.hourLabelQuiet()}>
          {[w?.description, w?.air_c == null ? null : `${Math.round(w.air_c)}°`]
            .filter(Boolean)
            .join(", ") || "–"}
        </span>
      );
    }
    if (band === "rain") {
      const wet = rowRain(rain, r);
      return (
        <span className={s.hourLabelQuiet()}>
          {wet === null
            ? "–"
            : wet < DRY_MM_PER_HOUR
              ? "Dry"
              : `${wet < 0.1 ? "<0.1" : wet.toFixed(1)} mm/h`}
        </span>
      );
    }
    if (band === "tide") {
      const at = r === rowAt(rows, now) ? now : r.time;
      const height = tideHeightAt(turns, at);
      const next = turns.find((t) => t.time > at);
      const depth = depthAt(at);
      if (height === null && depth === null)
        return <span className={s.hourLabelQuiet()}>No tide reading</span>;
      return (
        <>
          <span className={s.hourLabelLine()}>
            {height !== null && (
              <b className="font-semibold">{height.toFixed(1)} m</b>
            )}
            {next && (
              <span className={s.hourLabelQuiet()}>
                {next.tide === "high" ? "rising" : "falling"},{" "}
                {next.tide === "high" ? "high" : "low"} {clock(next.time)}
              </span>
            )}
          </span>
          {depth !== null && (
            <span className={s.hourLabelQuiet()}>
              Launch {depth.toFixed(1)} m
            </span>
          )}
        </>
      );
    }
    const reading = current.columns[rows.indexOf(r)];
    return (
      <span className={s.hourLabelQuiet()}>
        {reading
          ? `${currentText(reading.speed, units)}${reading.speed >= MIN_ARROW_MS ? ` to ${compass(reading.towards)}` : ""}`
          : (current.note ?? "–")}
      </span>
    );
  };
  /** What the label says for a row of the Waves section at the hour. */
  const waveLabel = (band: WaveBand, r: SpotRow): React.ReactNode => {
    const w = waves?.rows[rows.indexOf(r)] ?? null;
    if (band === "wblend") {
      return (
        <>
          {waves?.lines.map((l) => {
            const own = w?.models[l.id];
            return own ? (
              <span
                key={l.id}
                className={s.hourLabelModel()}
                data-card-model={l.id}
              >
                <ModelMark wave={l.id} />
                {waveModelName(l.id)}
                <b className="ml-auto font-semibold">
                  {heights.text(own.height_m)}
                </b>
              </span>
            ) : null;
          })}
          {w?.blendM != null && (
            <span className={s.hourLabelModel()} data-card-model="blend">
              <ModelMark blend />
              Blend
              <b className="ml-auto font-semibold">{heights.text(w.blendM)}</b>
            </span>
          )}
        </>
      );
    }
    if (band in WAVE_PART) {
      const part = partOf(w, band as PartRow);
      if (!part)
        return (
          <span className={s.hourLabelQuiet()} data-card-part={band}>
            {PART_ROWS.some(([key]) => partOf(w, key))
              ? `No ${WAVE_NAME[band].toLowerCase()} this hour`
              : NO_SWELL_SPLIT}
          </span>
        );
      return (
        <span className={s.hourLabelLine()} data-card-part={band}>
          <span className={s.hourLabelQuiet()}>{WAVE_NAME[band]}</span>
          <b className="font-semibold">
            <PartLine part={part} />
          </b>
        </span>
      );
    }
    if (!w || w.heightM === null)
      return <span className={s.hourLabelQuiet()}>No wave reading</span>;
    return (
      <>
        <b className="font-semibold">
          <SeaLine at={w} />
        </b>
        {w.lowM !== null && w.highM !== null && w.highM > w.lowM && (
          <span className={s.hourLabelQuiet()}>
            Models {heights.range(w.lowM, w.highM)}
          </span>
        )}
      </>
    );
  };
  const labelFor = (at: Section, where: NonNullable<typeof card>) =>
    shownRow ? (
      <div
        className={s.hourLabel({
          className: where.flip ? "-translate-x-full" : undefined,
        })}
        style={{ left: where.left, top: where.top }}
        data-card={at}
        data-card-band={where.band}
        aria-hidden="true"
      >
        <span className="font-semibold" data-card-hour>
          {hourWords}
        </span>
        {at === "wind"
          ? windLabel(where.band as WindBand, shownRow)
          : waveLabel(where.band as WaveBand, shownRow)}
      </div>
    ) : null;
  const graphProps = (at: Section) => ({
    className: s.graph(),
    onScroll,
    onPointerDown: pressHours,
    onTouchStart: drive,
    onWheel: drive,
    onKeyDown: onKey,
    onFocus: (e: React.FocusEvent<HTMLDivElement>) => {
      drive(e);
      setTagAt(at);
      if (e.target.matches(":focus-visible")) setKeyFocus(true);
    },
    onBlur: () => setKeyFocus(false),
    tabIndex: 0,
    role: "slider",
    "aria-label": `${at === "wind" ? "Wind" : "Waves"} graph: the arrow keys move the hour, up and down the rows, Esc lets go`,
    "aria-orientation": "horizontal" as const,
    "aria-valuemin": 0,
    "aria-valuemax": rows.length - 1,
    "aria-valuenow": Math.max(0, shownAt),
    "aria-valuetext": shownRow ? hourWords : "Now",
    "data-playhead": phone || undefined,
  });
  const svgProps = (at: Section) => ({
    onPointerMove: phone ? undefined : onMove(at),
    onPointerLeave: phone ? undefined : onLeave,
    onClick: phone ? tapRow(at) : onClick,
    className: "block",
  });
  /** A label's x kept in the window of the hours, `margin` from its edges. */
  const clampX = (x: number, margin: number) =>
    Math.min(Math.max(x, scrolled + margin), scrolled + width - margin);
  /** A note drawn from `x` that would not run into the now line. */
  const clearOfNow = (x: number) => X(now) < x - 4 || X(now) > x + 128;
  // Below a sky group's own width, every other one.
  const skyEvery = 3 * px >= 46 ? 3 : 6;
  /** What says the hour on a section's rail: Now, and the cursor's tag. */
  const railMarks = (at: Section) => {
    const half = phone ? 84 : heldHere ? 54 : 44;
    return (
      <>
        {seen({ time: now }) &&
          X(now) >= scrolled &&
          X(now) <= scrolled + width &&
          !(tagRow && Math.abs(mid(tagRow) - X(now)) < TAG_CLEAR) && (
            <span
              className={s.nowTag()}
              style={{ left: Math.max(X(now), scrolled + 18) }}
              data-now-tag={at}
            >
              Now
            </span>
          )}
        {tagRow && (phone || tagAt === at) && (
          <span
            className={s.cursorSpot()}
            style={{ left: clampX(mid(tagRow), half) }}
          >
            <span
              className={s.cursorTag({
                className: keyFocus ? s.cursorTagFocus() : undefined,
              })}
              data-cursor-tag={at}
              data-held={heldHere || undefined}
              data-measured={
                phone && at === "wind" && isNow && nowMeasured
                  ? nowMeasured.paired.station.id
                  : undefined
              }
            >
              <span data-cursor-hour>{tagWords}</span>
              {phone && tagReading(at, tagRow) && (
                <span>{` · ${tagReading(at, tagRow)}`}</span>
              )}
              {heldHere && letGo}
            </span>
          </span>
        )}
      </>
    );
  };
  /** The days along the head of a section's graph, on its hours. */
  const dayHeads = (at: Section) => (
    <div className={s.dayHeads()}>
      <div />
      <div
        className={s.headStrip()}
        ref={at === "wind" ? heads : waveHeads}
        data-day-heads={at}
      >
        <div className={s.headRow()} style={{ width: W }}>
          {days.map(({ day, sun, midnight }, i) => {
            if (!drawn(midnight)) return null;
            const names = dayNames(day.date, now);
            const dayLeft = Math.max(0, X(midnight));
            const dayWidth = X(midnight + 24 * HOUR) - dayLeft;
            // How much of the day has room for its name, on the graph and
            // on the screen: a name that cannot fit whole is not drawn, nor a
            // daylight range without the name before it.
            const room = Math.min(
              dayWidth,
              X(midnight + 24 * HOUR) - Math.max(dayLeft, scrolled),
            );
            if (room < 140) return null;
            const roomy = wide && room >= 270;
            const title =
              names.relative === "Today" || names.relative === "Tomorrow"
                ? `${names.relative}, ${names.short} ${Number(day.date.slice(8, 10))}`
                : `${names.long} ${Number(day.date.slice(8, 10))}`;
            return (
              <div
                key={day.date}
                className={s.dayHead({
                  className: i === 0 ? s.dayHeadFirst() : undefined,
                })}
                style={{ left: dayLeft, width: dayWidth }}
              >
                <span className={s.dayHeadName()} data-day-head={day.date}>
                  {title}
                  {sun.firstLight && sun.lastLight && roomy && (
                    <span className={s.dayHeadLight()}>
                      {clock(sun.firstLight)}–{clock(sun.lastLight)}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
  /** On a phone, a tap on a row asks it for its label; a second puts it away. */
  const tapRow = (at: Section) => (e: React.MouseEvent<SVGSVGElement>) => {
    if (shownAt < 0) return;
    const next = place(at, shownAt, e.clientY);
    setCard((was) => (was && next && was.band === next.band ? null : next));
  };
  useEffect(() => {
    if (!phone || !card) return;
    const away = (e: PointerEvent) => {
      if (
        !(e.target as Element).closest("[data-spot-graph], [data-wave-graph]")
      )
        setCard(null);
    };
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [phone, card]);
  const windModels = models.map((m) => modelName(m.id)).join(", ");
  const waveModels = waves?.lines.map((l) => waveModelName(l.id)).join(", ");
  return (
    <>
      {arrowsAt &&
        createPortal(
          <>
            <Button
              variant="quiet"
              size="sm"
              icon
              aria-label="Earlier days"
              disabled={scrolled <= 1}
              onClick={() => stepDay(-1)}
              data-hours-back
            >
              <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
            </Button>
            <Button
              variant="quiet"
              size="sm"
              icon
              aria-label="Later days"
              disabled={scrolled >= W - width - 1}
              onClick={() => stepDay(1)}
              data-hours-on
            >
              <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </>,
          arrowsAt,
        )}
      <section aria-labelledby="week-wind" data-week-section="wind">
        <div className={s.weekHead()}>
          <div className={s.weekTitle()}>
            <h3 className={s.h3()} id="week-wind">
              Wind
            </h3>
            {switcher}
          </div>
          {windModels && (
            <span className={s.weekSub()}>
              {wide ? windModels : `${models.length} models`}
            </span>
          )}
        </div>
        <div className={s.gbox()} ref={gbox}>
          {dayHeads("wind")}
          <BandNames
            height={GH}
            bands={(Object.keys(ROW) as WindBand[])
              .filter((band) => rated || band !== "stars")
              .map((band) => [
                WIND_NAME[band],
                band === "stars"
                  ? ROW.stars[0] + 10
                  : band === "wind"
                    ? ROW.wind[0] + 40
                    : band === "dir"
                      ? ROW.dir[0] + 18
                      : band === "tide"
                        ? ROW.tide[0] + 30
                        : band === "sky"
                          ? ROW.sky[0] + 20
                          : ROW[band][0] + Math.min(ROW[band][1], 40) / 2,
                ROW[band],
              ])}
          />
          <div {...graphProps("wind")} ref={ref} data-spot-graph>
            <svg
              ref={windSvg}
              width={W}
              height={GH}
              viewBox={`0 0 ${W} ${GH}`}
              {...svgProps("wind")}
              data-graph-svg
            >
              <defs>
                <linearGradient
                  id="spot-wind"
                  gradientUnits="userSpaceOnUse"
                  x1={0}
                  x2={W}
                  y1={0}
                  y2={0}
                >
                  {windRows.map((r, i) => (
                    <stop
                      key={i}
                      offset={Math.min(1, Math.max(0, mid(r) / W)).toFixed(4)}
                      stopColor={windCss(r.hour.wind!.wind_kn)}
                    />
                  ))}
                </linearGradient>
                {deepAt !== null && (
                  <clipPath id="spot-deep">
                    <rect x={0} y={0} width={W} height={TY(deepAt)} />
                  </clipPath>
                )}
              </defs>
              {frame(GH, ay, true)}
              {rows.map((r, i) =>
                // Only where there are stars: an hour rated none says so in its
                // label, not with a grey dash the length of the night.
                r.rating?.stars && seen(r) ? (
                  <rect
                    key={i}
                    x={X(r.time) + 1}
                    y={ROW.stars[0]}
                    width={r.step * px - 2}
                    height={ROW.stars[1]}
                    rx={2}
                    className={STAR_FILL[r.rating.stars]}
                  />
                ) : null,
              )}
              {spread && (
                <path d={spread} className="fill-ink" fillOpacity={0.07} />
              )}
              {mean.line && (
                <>
                  <path
                    d={mean.area}
                    fill="url(#spot-wind)"
                    fillOpacity={0.78}
                  />
                  <path
                    d={mean.line}
                    fill="none"
                    stroke="url(#spot-wind)"
                    strokeWidth={2.2}
                band === "dir" && speed.unit ? `${speed.unit}, gust` : null,
                  />
                </>
              )}
              {gust && (
                <path
                  d={gust}
                  className="fill-none stroke-gust"
                  strokeWidth={1.6}
                  strokeDasharray="4 3"
                />
              )}
              {readings.length > 0 && (
                <g data-measured={measured!.station.id}>
                  {/* On a ground-coloured halo, so the gold reads over the
                      wind's own colours and the paper alike. */}
                  {measuredLine && (
                    <>
                      <path
                        d={measuredLine}
                        className="fill-none stroke-ground"
                        strokeWidth={4.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d={measuredLine}
                        className="fill-none stroke-buoy"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        data-measured-line
                      />
                    </>
                  )}
                  {readings.map((r) =>
                    r.gustKn === null ? null : (
                      <circle
                        key={`g${r.time}`}
                        cx={rx(r)}
                        cy={Y(r.gustKn)}
                        r={2.3}
                        className="fill-ground stroke-buoy"
                        strokeWidth={1.4}
                        data-measured-gust={r.time}
                      />
                    ),
                  )}
                  {readings.map((r) => (
                    <circle
                      key={`w${r.time}`}
                      cx={rx(r)}
                      cy={Y(r.windKn)}
                      r={2.6}
                      className="fill-buoy stroke-ground"
                      strokeWidth={1.2}
                      data-measured-wind={r.time}
                    />
                  ))}
                </g>
              )}
              {[10, 20, 30].map((k) => (
                <text
                  key={k}
                  x={W - 6}
                  y={Y(k) - 3}
                  textAnchor="end"
                  className="fill-ink-muted font-body text-caption"
                >
                  {speed.say(k)}
                </text>
              ))}
              {/* What the gusts do to the stars, hour by hour: a bar under the
                  figures, never through them. */}
              {rated &&
                windRows.map((r, i) => {
                  const g = gustReading(
                    r.hour.wind!.wind_kn,
                    r.hour.wind!.gust_kn,
                    rider,
                  );
                  return g?.kind === "costs" || g?.kind === "over" ? (
                    <rect
                      key={i}
                      x={X(r.time) + 1}
                      y={ROW.dir[0] + 38}
                      width={Math.max(1, r.step * px - 2)}
                      height={3}
                      rx={1.5}
                      className="fill-gust"
                      fillOpacity={g.kind === "over" ? 0.9 : 0.45}
                      data-gust-tint={g.kind}
                    />
                  ) : null;
                })}
              {windRows
                .filter((r) => dublinHour(r.time) % 3 === 0)
                .map((r, i) => (
                  <g key={i}>
                    <g
                      transform={`translate(${mid(r)},${ROW.dir[0] + 9}) rotate(${r.hour.wind!.direction_deg + 180})`}
                    >
                      <path
                        d={ARROW}
                        className={
                          isOff(r.shore)
                            ? "fill-none stroke-pen"
                            : "fill-none stroke-ink"
                        }
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                    <text
                      x={mid(r)}
                      y={ROW.dir[0] + 34}
                      textAnchor="middle"
                      className={`fill-ink font-body text-body font-semibold tabular-nums ${halo(r.time)}`}
                      data-wind-figure={speed.say(r.hour.wind!.wind_kn)}
                    >
                      {speed.say(r.hour.wind!.wind_kn)}
                      {speed.gust(
                        r.hour.wind!.wind_kn,
                        r.hour.wind!.gust_kn,
                      ) !== null && (
                        <tspan
                          dx={3}
                          dy={-6}
                          className="fill-gust-ink text-caption"
                          data-gust={speed.say(
                            speed.gust(
                              r.hour.wind!.wind_kn,
                              r.hour.wind!.gust_kn,
                            )!,
                          )}
                        >
                          {speed.say(
                            speed.gust(
                              r.hour.wind!.wind_kn,
                              r.hour.wind!.gust_kn,
                            )!,
                          )}
                        </tspan>
                      )}
                    </text>
                  </g>
                ))}
              {curve.line && (
                <>
                  <path d={curve.area} className="fill-sea-3" />
                  {deepAt !== null && (
                    <path
                      d={curve.area}
                      className="fill-depth"
                      fillOpacity={0.9}
                      clipPath="url(#spot-deep)"
                    />
                  )}
                  <path
                    d={curve.line}
                    className="fill-none stroke-ink-2"
                    strokeWidth={1.4}
                  />
                </>
              )}
              {turns
                .filter(
                  (t) =>
                    t.time >= start &&
                    t.time <= end &&
                    seen(t) &&
                    X(t.time) >= scrolled - 34 &&
                    X(t.time) <= scrolled + width + 34,
                )
                .map((t, i) => (
                  <text
                    key={i}
                    x={clampX(X(t.time), 18)}
                    y={t.tide === "high" ? TY(t.height) - 6 : TY(t.height) + 15}
                    textAnchor="middle"
                    className={`fill-ink-2 font-body text-caption ${halo(t.time)}`}
                  >
                    {clock(t.time)}
                  </text>
                ))}
              <LowerBands
                rows={rows}
                seen={seen}
                apart={apart}
                lower={lower.at}
                X={X}
                px={px}
                W={W}
                hover={hover}
                halo={halo}
                models={models}
                blend={blend}
                current={current}
                rain={rain}
                units={units}
              />
              {handovers.filter(seen).map((h, i) => (
                <g key={i}>
                  <line
                    x1={X(h.time)}
                    x2={X(h.time)}
                    y1={ROW.wind[0] - 6}
                    y2={ROW.dir[0] + 40}
                    className="stroke-ink-muted"
                    strokeDasharray="3 4"
                  />
                  {X(h.time) >= scrolled && clearOfNow(X(h.time) + 6) && (
                    <text
                      x={X(h.time) + 6}
                      y={ROW.wind[0] + 6}
                      className="fill-ink-muted font-body text-caption"
                    >
                      {modelName(h.to)} from here
                    </text>
                  )}
                </g>
              ))}
              {marks(ay)}
              {hoverRow?.hour.wind && (
                <circle
                  cx={mid(hoverRow)}
                  cy={Y(hoverRow.hour.wind.wind_kn)}
                  r={4}
                  fill={windCss(hoverRow.hour.wind.wind_kn)}
                  className="stroke-ground"
                  strokeWidth={2}
                />
              )}
            </svg>
            {lower.at.current && current.columns.length === 0 && (
              // Said once, and kept in view as the hours scroll under it.
              <div
                className="pointer-events-none absolute left-0"
                style={{ top: lower.at.current[0] + 10, width: W }}
              >
                <span
                  className="sticky left-3 inline-block font-body text-caption text-ink-muted"
                  data-current-note
                >
                  {current.note ?? "Current: reading…"}
                </span>
              </div>
            )}
            {railMarks("wind")}
            {rows
              .filter(
                (r) =>
                  r.hour.weather &&
                  dublinHour(r.time) % skyEvery === 0 &&
                  seen(r),
              )
              .map((r, i) => (
                <span
                  key={i}
                  className={s.sky({
                    className: halo(r.time) ? s.skyNight() : undefined,
                  })}
                  style={{ left: mid(r) - 10, top: ROW.sky[0] + 4 }}
                >
                  <SkyGlyph
                    weather={r.hour.weather!}
                    size={16}
                    dark={!r.hour.daylight}
                  />
                  {r.hour.weather!.air_c !== null &&
                    `${Math.round(r.hour.weather!.air_c)}°`}
                </span>
              ))}
          </div>
          {card?.section === "wind" && labelFor("wind", card)}
        </div>
      </section>
      {waves && waveStack && (
        <section aria-labelledby="week-waves" data-week-section="waves">
          <div className={s.weekHead({ className: "mt-6" })}>
            <h3 className={s.h3()} id="week-waves">
              Waves
            </h3>
            {waveModels && (
              <span className={s.weekSub()}>
                {wide ? waveModels : `${waves.lines.length} models`}
              </span>
            )}
          </div>
          <div className={s.gbox()} ref={waveBox}>
            {dayHeads("waves")}
            <BandNames
              height={waveStack.height}
              bands={(Object.keys(waveStack.at) as WaveBand[]).map((band) => {
                const [y, h] = waveStack.at[band]!;
                return [
                  WAVE_NAME[band],
                  band === "waves"
                    ? y + 18
                    : band === "wdir"
                      ? y + 18
                      : y + Math.min(h, 40) / 2,
                  [y, h],
                ];
              })}
            />
            <div {...graphProps("waves")} ref={waveRef} data-wave-graph>
              <svg
                ref={waveSvg}
                width={W}
                height={waveStack.height}
                viewBox={`0 0 ${W} ${waveStack.height}`}
                {...svgProps("waves")}
                data-wave-svg
              >
                {frame(waveStack.height, waveStack.axis, false)}
                <WaveBands
                  rows={rows}
                  waves={waves}
                  seen={seen}
                  apart={apart}
                  bands={waveStack.at}
                  X={X}
                  px={px}
                  W={W}
                  hover={hover}
                  end={end}
                  handovers={waveHandovers(rows, waves).filter(seen)}
                  scrolled={scrolled}
                  halo={halo}
                  pointed={card?.section === "waves" ? card.band : null}
                />
                {marks(waveStack.axis)}
              </svg>
              {railMarks("waves")}
              {partsEnded !== null && (
                // Said once, and kept in view as the hours scroll under it.
                <div
                  className="pointer-events-none absolute left-0"
                  style={{ top: partsEnded, width: W }}
                >
                  <span
                    className="sticky left-3 inline-block font-body text-caption text-ink-muted"
                    data-parts-note
                  >
                    {NO_SWELL_SPLIT}
                  </span>
                </div>
              )}
            </div>
            {card?.section === "waves" && labelFor("waves", card)}
          </div>
        </section>
      )}
      {/* One key for both sections, in groups as the graph's bands run, each
          mark drawn as the graph draws it. Closed until it is asked for. */}
      <Disclosure
        title="Key"
        as="span"
        small
        className="px-1 pt-3 wide:px-4"
        data-disclosure="key"
      >
        <div className={s.legend()} data-legend>
          <KeyGroup name="Wind">
            <KeyItem mark="wind">Wind</KeyItem>
            <KeyItem mark="gust">Gust</KeyItem>
            {readings.length > 0 && (
              <KeyItem mark="measured" data-measured-key>
                Measured at {pairedName(measured!)}, wind and gust
              </KeyItem>
            )}
            {/* A point reads one model an hour: nothing to disagree. */}
                  band === "wdir" ? heights.unit : null,
            {rated && <KeyItem mark="spread">Where models disagree</KeyItem>}
          </KeyGroup>
          {models.length > 0 && (
            <KeyGroup
              name={`Models${speed.unit ? `, ${speed.unit}` : ""}`}
              data-models-legend
            >
              {models.map((m) => {
                const at = shownRow
                  ? m.points.find((p) => p.time === shownRow.time)
                  : undefined;
                return (
                  <KeyItem
                    key={m.id}
                    hue={modelHue(m.id).wind}
                    dashed={DASHED.has(m.id)}
                    figure={at ? speed.say(at.kn) : ""}
                    data-model-key={m.id}
                  >
                    {modelName(m.id)}
                  </KeyItem>
                );
              })}
              {models.length > 1 && (
                <KeyItem
                  mark="blend"
                  figure={(() => {
                    const b = shownRow ? blend.get(shownRow.time) : undefined;
                    return b ? speed.say(b.kn) : "";
                  })()}
                  data-model-key="blend"
                >
                  Blend
                </KeyItem>
              )}
            </KeyGroup>
          )}
          {rated && (
            <KeyGroup name="Gusts">
              <KeyItem mark="costs">Costs a star</KeyItem>
              <KeyItem mark="over">Past too much: no stars</KeyItem>
            </KeyGroup>
          )}
          <KeyGroup name="Sky and water" wide>
            {!dark && <KeyItem mark="dark">Dark</KeyItem>}
            <KeyItem mark="rain">Rain, mm/h</KeyItem>
            <KeyItem mark="current">
              Current: where it runs, in {unitLabel(currentUnits(units))}
            </KeyItem>
            {deepAt !== null && (
              <KeyItem mark="depth">1 m of water or more at the launch</KeyItem>
            )}
          </KeyGroup>
        </div>
        {waves && waveStack && (
          <div className={s.legend()} data-wave-legend>
            <KeyGroup name="Waves">
              <KeyItem mark="sea">
                {waveModel === WAVE_BLEND
                  ? "Wave height: the blend, the finest model where it has none"
                  : waveModel
                    ? `Wave height: ${waveModelName(waveModel)}, and the next model past its run`
                    : "Wave height: the finest model at each hour"}
              </KeyItem>
              {waves.lines.length > 1 && (
                <KeyItem mark="spread">Where models disagree</KeyItem>
              )}
              <KeyItem mark="waves">
                Arrow: where they run; figure:{" "}
                {heights.unit === "ft" ? "feet" : "metres"}
              </KeyItem>
            </KeyGroup>
            <KeyGroup
              name={`Models, ${heights.unit}`}
              wide
              data-wave-models-legend
            >
              {waves.lines.map((l) => {
                const own = waveAt?.models[l.id];
                const detail = modelEntry(l.id)?.detail;
                return (
                  <KeyItem
                    key={l.id}
                    stroke={waveHue(l.id).stroke}
                    dashed={DASHED.has(l.id)}
                    figure={own ? heights.figure(own.height_m) : ""}
                    data-model-key={l.id}
                  >
                    {waveModelName(l.id)}
                    {detail && (
                      <span className="text-ink-muted"> · {detail}</span>
                    )}
                  </KeyItem>
                );
              })}
              {waves.blended && (
                <KeyItem
                  mark="blend"
                  figure={
                    waveAt?.blendM != null ? heights.figure(waveAt.blendM) : ""
                  }
                  data-model-key="blend"
                >
                  Blend
                </KeyItem>
              )}
            </KeyGroup>
            {PART_ROWS.some(([key]) => waveStack.at[key]) && (
              <KeyGroup name="Swell">
                <KeyItem mark="swell">
                  Each train: how high, its period, where it runs
                </KeyItem>
              </KeyGroup>
            )}
          </div>
        )}
      </Disclosure>
    </>
  );
}

/** The partition bands, by key: a band of the waves' section only where it has data. */
const WAVE_PART: Record<string, true> = Object.fromEntries(
  PART_ROWS.map(([key]) => [key, true]),
);

/** The height left clear along the top of each plot for the hour's tag. */
const RAIL = 24;
/** A day has to show this many pixels to count as in view, on the strip. */
const WHOLE_DAY_PX = 48;
/** How near the cursor's tag can stand to the Now tag before Now gives way. */
const TAG_CLEAR = 64;
/** The hour label's widest, and its gap from the hour's column, for placing it. */
const LABEL_WIDTH = 208;
const LABEL_GAP = 10;

/**
 * A section's band names, in a column of their own beside the hours, each in
 * a strip as tall as its band.
 */
function BandNames({
  height,
  bands,
}: {
  height: number;
  /** Each band's name, its middle, its span, and what its figures are in. */
  bands: (readonly [
    string,
    number,
    readonly [number, number],
    (string | null)?,
  ])[];
}) {
  const s = styles();
  return (
    <div className={s.gl()} style={{ height }}>
      {bands.map(([name, middle, [y, h], unit]) => (
        <div
          key={`${name}${y}`}
          className={s.glBand()}
          style={{
            top: middle - 8,
            height: Math.max(16, y + h - (middle - 8)),
          }}
        >
          <span className={s.glName()} data-band-name={name}>
            {name}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A model's line, small, as the graph draws it: in its colour, dashed if it is. */
function ModelMark({
  wind,
  wave,
  blend = false,
}: {
  wind?: string;
  wave?: string;
  blend?: boolean;
}) {
  const id = wind ?? wave ?? "";
  return (
    <svg
      className="h-1.5 w-3.5 shrink-0 overflow-visible"
      viewBox="0 0 14 6"
      aria-hidden="true"
    >
      <path
        d="M1 3H13"
        fill="none"
        stroke={wind ? modelHue(wind).wind : undefined}
        className={
          blend ? "stroke-ink" : wave ? waveHue(wave).stroke : undefined
        }
        strokeWidth={blend ? 2.5 : 2}
        strokeLinecap="round"
        strokeDasharray={!blend && DASHED.has(id) ? "3 2" : undefined}
      />
    </svg>
  );
}

/** What a key's mark is: one of the graph's own, or a model's line in its hue. */
type KeyMarkKind =
  | "wind"
  | "gust"
  | "measured"
  | "spread"
  | "costs"
  | "over"
  | "waves"
  | "current"
  | "depth"
  | "dark"
  | "rain"
  | "blend"
  | "sea"
  | "swell";

/** A group of the key under the graph: a small heading, and its marks. */
function KeyGroup({
  name,
  wide = false,
  children,
  ...data
}: {
  name: string;
  /** Its words are long: the whole width on a phone. */
  wide?: boolean;
  children: React.ReactNode;
  "data-models-legend"?: boolean;
  "data-wave-models-legend"?: boolean;
}) {
  const s = styles();
  return (
    <div
      className={s.kGroup({ className: wide ? "max-wide:col-span-2" : "" })}
          {unit && <span className={s.glUnit()}>{unit}</span>}
      {...data}
    >
      <span className={s.kHead()}>{name}</span>
      <ul className={s.kList()}>{children}</ul>
    </div>
  );
}

/**
 * One mark of the key, drawn as the graph draws it, at one size for every
 * mark: `mark` is the kind, or a model's line in its colour, `hue` (a wind
 * model's) or `stroke` (a wave model's class), dashed if its line is. A
 * model's figure at the hour read out sits in a slot of its own, kept
 * whether there is a figure or not, so the key never rewraps as the hours
 * move.
 */
function KeyItem({
  mark,
  hue,
  stroke,
  dashed = false,
  figure,
  children,
  ...data
}: {
  mark?: KeyMarkKind;
  hue?: string;
  stroke?: string;
  dashed?: boolean;
  figure?: string;
  children: React.ReactNode;
  "data-model-key"?: string;
  "data-measured-key"?: boolean;
}) {
  const s = styles();
  return (
    <li className={s.kItem()} {...data}>
      <svg
        className={s.kMark()}
        viewBox="0 0 20 12"
        aria-hidden="true"
        data-key-mark={mark ?? "model"}
      >
        {mark ? (
          <KeyMark mark={mark} />
        ) : (
          // A model's own line, in its hue (the ruling of 2026-09-16).
          <path
            d="M0 6H20"
            fill="none"
            stroke={hue}
            className={stroke}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeDasharray={dashed ? DASH : undefined}
          />
        )}
      </svg>
      <span className={s.kWords()}>{children}</span>
      {figure !== undefined && <b className={s.kFigure()}>{figure}</b>}
    </li>
  );
}

function KeyMark({ mark }: { mark: KeyMarkKind }) {
  switch (mark) {
    case "wind":
      return (
        <>
          <path
            d="M0 7C4 4 7 5 10 4.5S16 2.5 20 3.5V12H0Z"
            className="fill-wind-k15"
            fillOpacity={0.78}
          />
          <path
            d="M0 7C4 4 7 5 10 4.5S16 2.5 20 3.5"
            className="fill-none stroke-wind-k15"
            strokeWidth={1.6}
          />
        </>
      );
    case "gust":
      return (
        <path
          d="M0 6H20"
          className="fill-none stroke-gust"
          strokeWidth={1.6}
          strokeDasharray="4 3"
        />
      );
    case "measured":
      return (
        <>
          <path
            d="M1 8C6 6 9 7 14 5S18 4 19 4"
            className="fill-none stroke-buoy"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <circle
            cx={7}
            cy={6.8}
            r={2.4}
            className="fill-buoy stroke-ground"
            strokeWidth={1}
          />
          <circle
            cx={13}
            cy={1.6}
            r={2}
            className="fill-ground stroke-buoy"
            strokeWidth={1.3}
          />
        </>
      );
    case "spread":
      return (
        <path
          d="M0 4C5 1.5 10 3 20 1.5V10C12 11 6 9.5 0 10.5Z"
          className="fill-ink"
          fillOpacity={0.14}
        />
      );
    case "costs":
    case "over":
      return (
        <rect
          x={0}
          y={1}
          width={20}
          height={10}
          rx={2}
          className="fill-gust"
          fillOpacity={mark === "over" ? 0.9 : 0.45}
        />
      );
    case "waves":
    case "current":
      return (
        <g transform="translate(10 6) rotate(45) scale(0.8)">
          <path
            d={ARROW}
            className={
              mark === "waves"
                ? "fill-none stroke-depth"
                : "fill-none stroke-ink-2"
            }
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    case "depth":
      return (
        <rect
          x={0}
          y={1}
          width={20}
          height={10}
          rx={2}
          className="fill-depth"
          fillOpacity={0.9}
        />
      );
    case "dark":
      return (
        <rect
          x={0}
          y={0}
          width={20}
          height={12}
          rx={2}
          className="fill-ink"
          fillOpacity={0.09}
        />
      );
    case "blend":
      return (
        <path
          d="M0 6H20"
          className="fill-none stroke-ink"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      );
    case "sea":
      return (
        <rect
          x={0}
          y={4.5}
          width={20}
          height={3}
          rx={1.5}
          className="fill-sea-1"
          fillOpacity={0.9}
        />
      );
    case "swell":
      return (
        <>
          <path
            d="M0 9C5 7 9 8 14 7S18 6 20 6V12H0Z"
            className="fill-sea-1"
            fillOpacity={0.55}
          />
          <path
            d="M0 9C5 7 9 8 14 7S18 6 20 6"
            className="fill-none stroke-depth"
            strokeWidth={1.2}
          />
        </>
      );
    case "rain":
      return (
        <g className="fill-weather-rain">
          <rect x={1} y={7} width={5} height={5} rx={1} />
          <rect x={7.5} y={3} width={5} height={9} rx={1} />
          <rect x={14} y={5} width={5} height={7} rx={1} />
        </g>
      );
  }
}

/**
 * The wind section's bands under its sky, each a row of the chart's old dock
 * carried here when the dock gave way to the chart's scrub bar, on the
 * graph's own hours, its scroll, its nights and its pointer:
 *
 * - Models: every model the rider blends (Settings), its own wind as its
 *   own line in its own colour, the global models dashed, and their blend in
 *   ink over the band from the lowest model to the highest (`windBlend`), on
 *   the tens either side of the week's model winds so the lines fill the
 *   band. The blend is said here and nowhere else: the headline wind, and
 *   the stars, stay the one model's own.
 * - Rain: each row's mm/h as a bar, on the square root the dock's rain tint
 *   reads (force5/src/rain.ts), so a wet hour of 0.2 mm shows and a downpour
 *   still fits; the figure every third hour it rains.
 * - Current: where the water runs, and how fast; with none, the dock's note.
 */
function LowerBands({
  rows,
  seen,
  apart,
  lower,
  X,
  px,
  W,
  hover,
  halo,
  models,
  blend,
  current,
  rain,
  units,
}: {
  rows: readonly SpotRow[];
  /** Whether a row is drawn: not with the night left out and it after dark. */
  seen: (row: Pick<SpotRow, "time">) => boolean;
  /** Whether a night left out stands between two times: a line breaks there. */
  apart: (a: number, b: number) => boolean;
  lower: Stack<WindBand>["at"];
  X: (t: number) => number;
  px: number;
  W: number;
  hover: number | null;
  /** The class that keeps a figure clear of the night's hatch at its time. */
  halo: (t: number) => string;
  models: readonly ModelSeries[];
  blend: ReadonlyMap<number, WindBlendAt>;
  current: SpotCurrents;
  rain: ReadonlyMap<number, number>;
  units: Units;
}) {
  const speed = useSpeed();
  const mid = (r: Pick<SpotRow, "time" | "step">) =>
    X(r.time) + (r.step * px) / 2;
  const third = (r: SpotRow) => dublinHour(r.time) % 3 === 0 && seen(r);
  const caption = "font-body text-caption";
  const hovered = hover === null ? null : rows[hover];
  /** A line through points in runs, broken where a reading is missing. */
  const lineOf = (
    points: readonly { time: number; step: number }[],
    y: (i: number) => number,
  ) => {
    const out: (readonly [number, number])[][] = [];
    points.forEach((p, i) => {
      const before = points[i - 1];
      if (
        !before ||
        before.time + before.step * HOUR !== p.time ||
        apart(before.time, p.time)
      )
        out.push([]);
      out.at(-1)!.push([mid(p), y(i)]);
    });
    return out
      .filter((run) => run.length > 1)
      .map(smoothPath)
      .join("");
  };
  return (
    <>
      {lower.rain &&
        (() => {
          const [y, h] = lower.rain;
          const bar = h - 14;
          return (
            <g data-band="rain">
              <line
                x1={0}
                x2={W}
                y1={y + h}
                y2={y + h}
                className="stroke-line"
              />
              {rows.map((r, i) => {
                if (!seen(r)) return null;
                const rate = rowRain(rain, r);
                const tint = rate === null ? 0 : rainTint(rate);
                if (!tint) return null;
                const tall = Math.max(2, tint * bar);
                return (
                  <rect
                    key={i}
                    x={X(r.time) + 1}
                    y={y + h - tall}
                    width={Math.max(1, r.step * px - 2)}
                    height={tall}
                    rx={1.5}
                    className="fill-weather-rain"
                    data-rain={rate!.toFixed(2)}
                  />
                );
              })}
              {rows.filter(third).map((r, i) => {
                const rate = rowRain(rain, r);
                return rate === null || rate < DRY_MM_PER_HOUR ? null : (
                  <text
                    key={i}
                    x={mid(r)}
                    y={y + 9}
                    textAnchor="middle"
                    className={`fill-ink-2 ${caption} ${halo(r.time)}`}
                  >
                    {rate < 0.1 ? "<0.1" : rate.toFixed(1)}
                  </text>
                );
              })}
            </g>
          );
        })()}
      {lower.blend &&
        (() => {
          const [y, h] = lower.blend;
          // On the tens either side of the week's model winds, so the lines
          // fill the band rather than a strip of a scale from calm to 36 kn.
          const kns = models.flatMap((m) =>
            m.points.filter(seen).map((p) => p.kn),
          );
          const lo = kns.length ? Math.floor(Math.min(...kns) / 10) * 10 : 0;
          const hi = Math.max(
            lo + 10,
            kns.length ? Math.ceil(Math.max(...kns) / 10) * 10 : 20,
          );
          const MY = (k: number) => y + h - ((k - lo) / (hi - lo)) * h;
          // The blend's hours, in the rows' order, drawn where two models or
          // more feed it: with one, the blend is that model's own line.
          const blended =
            models.length > 1
              ? rows.filter((r) => seen(r) && blend.has(r.time))
              : [];
          const spread = blended.length
            ? (() => {
                const parts: string[] = [];
                let run: SpotRow[] = [];
                const flush = () => {
                  if (run.length > 1) {
                    const top = run.map(
                      (r) => [mid(r), MY(blend.get(r.time)!.high)] as const,
                    );
                    const bot = run
                      .map((r) => [mid(r), MY(blend.get(r.time)!.low)] as const)
                      .reverse();
                    parts.push(
                      `${smoothPath(top)}L${smoothPath(bot).slice(1)}Z`,
                    );
                  }
                  run = [];
                };
                blended.forEach((r, i) => {
                  const before = blended[i - 1];
                  if (
                    before &&
                    (before.time + before.step * HOUR !== r.time ||
                      apart(before.time, r.time))
                  )
                    flush();
                  run.push(r);
                });
                flush();
                return parts.join("");
              })()
            : "";
          const blendLine = lineOf(blended, (i) =>
            MY(blend.get(blended[i].time)!.kn),
          );
          return (
            <g data-band="wind-blend" data-scale={`${lo}-${hi}`}>
              {Array.from(
                { length: (hi - lo) / 10 + 1 },
                (_, i) => lo + i * 10,
              ).map((k) => (
                <g key={k}>
                  <line
                    x1={0}
                    x2={W}
                    y1={MY(k)}
                    y2={MY(k)}
                    className="stroke-line"
                    strokeDasharray="2 4"
                  />
                  <text
                    x={W - 6}
                    y={MY(k) - 3}
                    textAnchor="end"
                    className={`fill-ink-muted ${caption}`}
                  >
                    {speed.say(k)}
                  </text>
                </g>
              ))}
              {spread && (
                <path d={spread} className="fill-ink" fillOpacity={0.06} />
              )}
              {models.map((m) => {
                // A model's line breaks where it has no reading, rather than
                // drawing a guess across the hole.
                const points = m.points.filter(seen);
                return (
                  <path
                    key={m.id}
                    d={lineOf(points, (i) => MY(points[i].kn))}
                    fill="none"
                    stroke={modelHue(m.id).wind}
                    strokeWidth={1.6}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray={DASHED.has(m.id) ? DASH : undefined}
                    data-model={m.id}
                  />
                );
              })}
              {blendLine && (
                <path
                  d={blendLine}
                  className="fill-none stroke-ink"
                  strokeWidth={2.2}
                  strokeLinejoin="round"
                  data-blend
                />
              )}
              {hovered &&
                seen(hovered) &&
                models.map((m) => {
                  const p = m.points.find((q) => q.time === hovered.time);
                  return p ? (
                    <circle
                      key={m.id}
                      cx={mid(p)}
                      cy={MY(p.kn)}
                      r={3}
                      fill={modelHue(m.id).wind}
                      className="stroke-ground"
                      strokeWidth={1.5}
                    />
                  ) : null;
                })}
              {hovered &&
                seen(hovered) &&
                models.length > 1 &&
                blend.has(hovered.time) && (
                  <circle
                    cx={mid(hovered)}
                    cy={MY(blend.get(hovered.time)!.kn)}
                    r={3.5}
                    className="fill-ink stroke-ground"
                    strokeWidth={1.5}
                  />
                )}
            </g>
          );
        })()}
      {lower.current && current.columns.length > 0 && (
        <g data-band="current">
          {rows.map((r, i) => {
            const reading = current.columns[i];
            if (!reading || !third(r)) return null;
            const [y] = lower.current!;
            return (
              <g key={i}>
                {reading.speed >= MIN_ARROW_MS && (
                  <g
                    transform={`translate(${mid(r)},${y + 10}) rotate(${reading.towards})`}
                  >
                    <path
                      d={ARROW}
                      className="fill-none stroke-ink-2"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                )}
                <text
                  x={mid(r)}
                  y={y + 34}
                  textAnchor="middle"
                  className={`fill-ink-2 ${caption} ${halo(r.time)}`}
                  data-current={currentFigure(reading.speed, units)}
                >
                  <title>
                    {`${currentText(reading.speed, units)}${reading.speed >= MIN_ARROW_MS ? ` towards ${compass(reading.towards)}` : ""}${current.model ? ` · ${current.model}` : ""}`}
                  </title>
                  {currentFigure(reading.speed, units)}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </>
  );
}

/**
 * The Waves section's bands (`WAVE_BANDS`), on the wind's hours:
 *
 * - Waves: the blended height (the models' median, `waveWeek`) as an area in
 *   the sea's colour, over the band from the lowest model to the highest;
 *   where the blend is missing, the leading model's own height.
 * - Direction: where the sea runs, as the arrow points, and its height.
 * - Period: the peak period, every third hour.
 * - Models: every wave model's own line through its own steps, in its
 *   own colour, the global ones dashed; the blend's in ink where it is
 *   published; and a dotted mark where a model's run ends inside the week.
 * - The swells and the wind sea: the lead model's own split, each its
 *   height as a low area and, every sixth hour, where it runs, how high and
 *   its period. One model's split, never averaged with another's.
 */
function WaveBands({
  rows,
  waves,
  seen,
  apart,
  bands,
  X,
  px,
  W,
  hover,
  end,
  handovers,
  scrolled,
  halo,
  pointed,
}: {
  rows: readonly SpotRow[];
  waves: WaveWeek;
  seen: (row: Pick<SpotRow, "time">) => boolean;
  apart: (a: number, b: number) => boolean;
  bands: Stack<WaveBand>["at"];
  X: (t: number) => number;
  px: number;
  W: number;
  hover: number | null;
  /** The week's end: a run that ends before it is marked where it does. */
  end: number;
  /** Where the headline's model changes (`waveHandovers`). */
  handovers: readonly { time: number; to: string }[];
  /** How far the hours are scrolled: a note past the left edge goes. */
  scrolled: number;
  /** The class that keeps a figure clear of the night's hatch at its time. */
  halo: (t: number) => string;
  /** The row under the pointer: over a swell, the other swells fade. */
  pointed: string | null;
}) {
  const heights = useHeights();
  const feet = heights.unit === "ft";
  const mid = (r: Pick<SpotRow, "time" | "step">) =>
    X(r.time) + (r.step * px) / 2;
  const caption = "font-body text-caption";
  const third = (r: SpotRow) => dublinHour(r.time) % 3 === 0 && seen(r);
  const sixth = (r: SpotRow) => dublinHour(r.time) % 6 === 3 && seen(r);
  const at = rows
    .map((row, i) => ({
      row,
      w: waves.rows[i],
      held: waves.rows[i]?.held ?? false,
    }))
    .filter(
      (p): p is { row: SpotRow; w: WaveRow; held: boolean } =>
        p.w !== null && p.w.heightM !== null && seen(p.row),
    );
  // Every wave model's height and the blend's on one scale, in half metres.
  const top = Math.max(
    0,
    ...at.map((p) => p.w.highM ?? p.w.heightM!),
    ...waves.lines.flatMap((l) => l.points.map((p) => p.m)),
  );
  const most = Math.max(1.5, Math.ceil(top * 2) / 2);
  // The scale's lines, each a height in metres: on the half metre, or on
  // whole feet in steps that leave a few lines at any height of sea.
  const feetTop = most * FEET_PER_METRE;
  const feetStep =
    feetTop <= 6 ? 2 : feetTop <= 12 ? 4 : feetTop <= 24 ? 6 : 10;
  const ticks = feet
    ? Array.from(
        { length: Math.floor(feetTop / feetStep) },
        (_, i) => ((i + 1) * feetStep) / FEET_PER_METRE,
      )
    : Array.from(
        { length: Math.floor(most / (most > 3 ? 1 : 0.5)) },
        (_, i) => (i + 1) * (most > 3 ? 1 : 0.5),
      );
  /**
   * Runs of the hours drawn, broken at a gap or a night left out. A `held`
   * hour keeps its run whole, between two of a coarse run's steps, and is not
   * drawn itself: the line goes through the steps.
   */
  const runsOf = <
    T extends { row: Pick<SpotRow, "time" | "step">; held: boolean },
  >(
    items: readonly T[],
  ): T[][] => {
    const out: T[][] = [];
    items.forEach((item, i) => {
      const before = items[i - 1];
      if (
        !before ||
        before.row.time + before.row.step * HOUR < item.row.time ||
        apart(before.row.time, item.row.time)
      )
        out.push([]);
      out.at(-1)!.push(item);
    });
    return out
      .map((run) => run.filter((item) => !item.held))
      .filter((run) => run.length > 1);
  };
  const band = (
    items: readonly { row: SpotRow; w: WaveRow; held: boolean }[],
    y: (m: number) => number,
  ) =>
    runsOf(items.filter((p) => p.w.lowM !== null && p.w.highM !== null))
      .map((run) => {
        const hi = run.map((p) => [mid(p.row), y(p.w.highM!)] as const);
        const lo = run
          .map((p) => [mid(p.row), y(p.w.lowM!)] as const)
          .reverse();
        return `${smoothPath(hi)}L${smoothPath(lo).slice(1)}Z`;
      })
      .join("");
  const hovered = hover === null ? null : rows[hover];
  const hoveredWave = hover === null ? null : waves.rows[hover];
  const scale = (y: number, h: number, ticks: readonly number[]) =>
    ticks.map((m) => {
      const yy = y + h - (m / most) * (h - 4);
      return (
        <g key={m}>
          <line
            x1={0}
            x2={W}
            y1={yy}
            y2={yy}
            className="stroke-line"
            strokeDasharray="2 4"
          />
          <text
            x={W - 6}
            y={yy - 3}
            textAnchor="end"
            className={`fill-ink-muted ${caption}`}
          >
            {feet ? `${Math.round(m * FEET_PER_METRE)} ft` : `${m} m`}
          </text>
        </g>
      );
    });
  return (
    <>
      {bands.waves &&
        (() => {
          const [y, h] = bands.waves;
          const HY = (m: number) =>
            y + h - (Math.min(m, most) / most) * (h - 4);
          const runs = runsOf(at);
          const lines = runs.map((run) =>
            run.map((p) => [mid(p.row), HY(p.w.heightM!)] as const),
          );
          return (
            <g data-band="waves">
              {scale(y, h, ticks)}
              {lines.map((pts, i) => (
                <path
                  key={i}
                  d={`${smoothPath(pts)}L${pts.at(-1)![0]},${y + h}L${pts[0][0]},${y + h}Z`}
                  className="fill-sea-1"
                  fillOpacity={0.9}
                />
              ))}
              <path
                d={band(at, HY)}
                className="fill-ink"
                fillOpacity={0.14}
                data-wave-spread
              />
              <path
                d={lines.map(smoothPath).join("")}
                className="fill-none stroke-depth"
                strokeWidth={2}
                data-wave-height
              />
              {/* Where the headline's model changes: its run has ended. */}
              {handovers.map((change) => (
                <g key={change.time} data-wave-handover={change.to}>
                  <line
                    x1={X(change.time)}
                    x2={X(change.time)}
                    y1={y - 6}
                    y2={(bands.wdir ?? bands.waves!)[0] + 40}
                    className="stroke-ink-muted"
                    strokeDasharray="3 4"
                  />
                  {X(change.time) >= scrolled && (
                    <text
                      x={X(change.time) + 6}
                      y={y + 6}
                      className={`fill-ink-muted ${caption}`}
                    >
                      {waveModelName(change.to)} from here
                    </text>
                  )}
                </g>
              ))}
              {hovered && hoveredWave?.heightM != null && seen(hovered) && (
                <circle
                  cx={mid(hovered)}
                  cy={HY(hoveredWave.heightM)}
                  r={4}
                  className="fill-depth stroke-ground"
                  strokeWidth={2}
                />
              )}
            </g>
          );
        })()}
      {bands.wdir &&
        (() => {
          const [y] = bands.wdir;
          return (
            <g data-band="wave-direction">
              {at
                .filter((p) => third(p.row) && !p.held)
                .map(({ row, w }, i) => (
                  <g key={i}>
                    {w.from !== null && (
                      <g
                        transform={`translate(${mid(row)},${y + 9}) rotate(${w.from + 180})`}
                      >
                        <path
                          d={ARROW}
                          className="fill-none stroke-depth"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </g>
                    )}
                    <text
                      x={mid(row)}
                      y={y + 34}
                      textAnchor="middle"
                      className={`fill-ink font-body text-body font-semibold tabular-nums ${halo(row.time)}`}
                      data-wave-height={w.heightM!.toFixed(1)}
                    >
                      {heights.figure(w.heightM!)}
                    </text>
                  </g>
                ))}
            </g>
          );
        })()}
      {bands.period &&
        (() => {
          const [y, h] = bands.period;
          return (
            <g data-band="period">
              {at
                .filter((p) => third(p.row) && !p.held && p.w.periodS !== null)
                .map(({ row, w }, i) => (
                  <text
                    key={i}
                    x={mid(row)}
                    y={y + h / 2 + 4}
                    textAnchor="middle"
                    className={`fill-ink-2 ${caption} ${halo(row.time)}`}
                    data-wave-period={Math.round(w.periodS!)}
                  >
                    {Math.round(w.periodS!)}s
                  </text>
                ))}
            </g>
          );
        })()}
      {bands.wblend &&
        (() => {
          const [y, h] = bands.wblend;
          const BY = (m: number) =>
            y + h - (Math.min(m, most) / most) * (h - 4);
          const blended = at
            .filter((p) => p.w.blendM !== null)
            .map((p) => ({ ...p, held: p.w.blendHeld }));
          // How far the longest run reaches in the hours drawn: a run that
          // ends there is cut by the graph, not ended.
          const reach = Math.max(...waves.lines.map((l) => l.last));
          return (
            <g data-band="wave-blend">
              {scale(
                y,
                h,
                ticks.filter((m) => m < most),
              )}
              <path d={band(at, BY)} className="fill-ink" fillOpacity={0.06} />
              {waves.lines.map((l) => {
                const points = l.points.filter(seen);
                // Through its own steps alone: a three-hourly model's line
                // goes from step to step, and breaks across a night left out.
                const lines: (readonly [number, number])[][] = [];
                points.forEach((p, i) => {
                  const before = points[i - 1];
                  if (
                    !before ||
                    p.time - before.time > 6 * HOUR ||
                    apart(before.time, p.time)
                  )
                    lines.push([]);
                  lines.at(-1)!.push([mid(p), BY(p.m)]);
                });
                return (
                  <path
                    key={l.id}
                    d={lines
                      .filter((run) => run.length > 1)
                      .map(smoothPath)
                      .join("")}
                    className={`fill-none ${waveHue(l.id).stroke}`}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={DASHED.has(l.id) ? DASH : undefined}
                    data-model={l.id}
                  />
                );
              })}
              {blended.length > 1 && (
                <path
                  d={runsOf(blended)
                    .map((run) =>
                      smoothPath(
                        run.map((p) => [mid(p.row), BY(p.w.blendM!)] as const),
                      ),
                    )
                    .join("")}
                  className="fill-none stroke-ink"
                  strokeWidth={2.2}
                  strokeLinejoin="round"
                  data-blend
                />
              )}
              {/* Where a model's run ends inside the week: past it, the
                  blend is made of the models that are left. */}
              {waves.lines
                .filter(
                  (l) =>
                    l.last + 3 * HOUR < reach &&
                    l.last + 3 * HOUR < end &&
                    l.last > (rows[0]?.time ?? 0) &&
                    seen({ time: l.last }),
                )
                .map((l) => {
                  const x = X(l.last) + px / 2;
                  return (
                    <g key={l.id} data-run-end={l.id}>
                      <line
                        x1={x}
                        x2={x}
                        y1={y - 4}
                        y2={y + h}
                        className="stroke-ink-muted"
                        strokeDasharray="3 4"
                      />
                      <circle
                        cx={x}
                        cy={y + 2}
                        r={3}
                        className={waveHue(l.id).fill}
                      />
                      {x >= scrolled && (
                        <text
                          x={x + 7}
                          y={y + 6}
                          className={`fill-ink-muted ${caption}`}
                        >
                          {waveEndName(l.id)} ends
                        </text>
                      )}
                    </g>
                  );
                })}
              {hovered &&
                seen(hovered) &&
                waves.lines.map((l) => {
                  const own = hoveredWave?.models[l.id];
                  return own ? (
                    <circle
                      key={l.id}
                      cx={mid(hovered)}
                      cy={BY(own.height_m)}
                      r={3}
                      className={`${waveHue(l.id).fill} stroke-ground`}
                      strokeWidth={1.5}
                    />
                  ) : null;
                })}
              {hovered && seen(hovered) && hoveredWave?.blendM != null && (
                <circle
                  cx={mid(hovered)}
                  cy={BY(hoveredWave.blendM)}
                  r={3.5}
                  className="fill-ink stroke-ground"
                  strokeWidth={1.5}
                />
              )}
            </g>
          );
        })()}
      {PART_ROWS.map(([key]) => {
        const at2 = bands[key];
        if (!at2) return null;
        const [y, h] = at2;
        const PY = (m: number) => y + h - (Math.min(m, most) / most) * (h - 18);
        const parts = rows
          .map((row, i) => ({
            row,
            part: partOf(waves.rows[i], key),
            held: waves.rows[i]?.held ?? false,
          }))
          .filter(
            (p): p is { row: SpotRow; part: WavePartHour; held: boolean } =>
              p.part !== null && seen(p.row),
          );
        const lines = runsOf(parts).map((run) =>
          run.map((p) => [mid(p.row), PY(p.part.heightM!)] as const),
        );
        return (
          <g
            key={key}
            data-band={key}
            opacity={
              pointed && pointed in WAVE_PART && pointed !== key
                ? 0.4
                : undefined
            }
          >
            {lines.map((pts, i) => (
              <path
                key={i}
                d={`${smoothPath(pts)}L${pts.at(-1)![0]},${y + h}L${pts[0][0]},${y + h}Z`}
                className="fill-sea-1"
                fillOpacity={0.55}
              />
            ))}
            <path
              d={lines.map(smoothPath).join("")}
              className="fill-none stroke-depth"
              strokeWidth={1.2}
            />
            {parts
              .filter((p) => sixth(p.row) && !p.held)
              .map(({ row, part }, i) => (
                <g key={i}>
                  {part.from !== null && (
                    <g
                      transform={`translate(${mid(row) - 17},${y + 8}) rotate(${part.from + 180}) scale(0.85)`}
                    >
                      <path
                        d={ARROW}
                        className="fill-none stroke-depth"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  )}
                  <text
                    x={mid(row) - 6}
                    y={y + 12}
                    className={`fill-ink-2 ${caption} ${halo(row.time)}`}
                    data-part={key}
                  >
                    <tspan className="fill-ink font-semibold">
                      {heights.figure(part.heightM!)}
                    </tspan>
                    {part.periodS !== null && ` ${Math.round(part.periodS)}s`}
                  </text>
                </g>
              ))}
          </g>
        );
      })}
    </>
  );
}

/** The waves on one line: "4 ft 13 s from W". */
function SeaLine({ at }: { at: WaveRow | null }) {
  const heights = useHeights();
  if (!at || at.heightM === null) return <>–</>;
  return (
    <>
      {heights.text(at.heightM)}
      {(at.periodS !== null || at.from !== null) && (
        <span className="font-normal text-ink-2">
          {at.periodS !== null && ` ${Math.round(at.periodS)} s`}
          {at.from !== null && ` from ${compass(at.from)}`}
        </span>
      )}
    </>
  );
}

/** A partition on one line: "4 ft 12 s W". */
function PartLine({ part }: { part: WavePartHour | null }) {
  const heights = useHeights();
  if (!part || part.heightM === null) return <>–</>;
  return (
    <>
      {heights.text(part.heightM)}
      {(part.periodS !== null || part.from !== null) && (
        <span className="font-normal text-ink-2">
          {part.periodS !== null && ` ${Math.round(part.periodS)} s`}
          {part.from !== null && ` ${compass(part.from)}`}
        </span>
      )}
    </>
  );
}

function HourTable({
  forecast,
  rows,
  date,
  now,
  turns,
  depthAt,
  rider,
  rated,
  rain,
  switcher,
}: {
  forecast: SpotForecast;
  rows: SpotRow[];
  date: string;
  now: number;
  turns: ReturnType<typeof tideTurns>;
  depthAt: (t: number) => number | null;
  rider: Rider;
  /** False at a point on the open water: no stars, no wing, no launch. */
  rated: boolean;
  rain: ReadonlyMap<number, number>;
  /** The Graph | Table switch, over the table as it is beside Wind's title. */
  switcher: React.ReactNode;
}) {
  const speed = useSpeed();
  const heights = useHeights();
  const s = styles();
  const light = rows.filter((r) => r.hour.daylight);
  return (
    <div className="mt-3 grid gap-2">
      <div className="flex justify-end">{switcher}</div>
      <div className="overflow-x-auto">
        <table className={s.table()} data-hour-table>
          <thead>
            <tr>
              <th className={s.th()}>{date ? dayNames(date, now).long : ""}</th>
              {rated && <th className={s.th()}>Stars</th>}
              <th className={s.th()}>Wind {speed.unit}</th>
              <th className={s.th({ className: s.narrow() })}>Gust factor</th>
              <th className={s.th()}>From</th>
              {/* A point reads one model an hour: no range to give. */}
              {rated && (
                <th className={s.th({ className: s.narrow() })}>Models</th>
              )}
              {rated && (
                <th className={s.th({ className: s.narrow() })}>Wing</th>
              )}
              <th className={s.th()}>Waves {heights.unit}</th>
              <th className={s.th({ className: s.narrow() })}>Period</th>
              {turns.length > 0 && <th className={s.th()}>Tide</th>}
              <th className={s.th({ className: s.narrow() })}>Air</th>
              <th className={s.th({ className: s.narrow() })}>Rain mm/h</th>
            </tr>
          </thead>
          <tbody>
            {light.map((r) => {
              const w = r.hour.wind;
              const d = depthAt(r.time);
              const g = w ? gustReading(w.wind_kn, w.gust_kn, rider) : null;
              const wet = rowRain(rain, r);
              return (
                <tr
                  key={r.time}
                  data-hour={new Date(r.time).toISOString()}
                  className={
                    !rated || r.rating?.stars ? undefined : "text-ink-muted"
                  }
                >
                  <td className={s.td()}>{clock(r.time)}</td>
                  {rated && <StarsCell row={r} forecast={forecast} />}
                  <td className={s.td()}>
                    <b className="font-semibold text-ink">
                      {w ? speed.say(w.wind_kn) : "–"}
                    </b>
                    {w && speed.gust(w.wind_kn, w.gust_kn) !== null && (
                      <span className="text-gust-ink">
                        {" "}
                        {speed.say(speed.gust(w.wind_kn, w.gust_kn)!)}
                      </span>
                    )}
                  </td>
                  <td
                    className={s.td({
                      className: `${s.narrow()} ${
                        rated && g && g.kind !== "fine" ? "text-gust-ink" : ""
                      }`,
                    })}
                    title={rated && g ? GUST_WORDS[g.kind] : undefined}
                    data-gust-cell={g?.kind}
                  >
                    {g ? g.text : "–"}
                  </td>
                  <td
                    className={s.td({
                      className: isOff(r.shore) ? s.off() : undefined,
                    })}
                  >
                    {w ? compass(w.direction_deg) : "–"}
                    {shoreWord(r.shore) && ` · ${shoreWord(r.shore)}`}
                  </td>
                  {rated && (
                    <td className={s.td({ className: s.narrow() })}>
                      {w
                        ? `${speed.say(w.min_kn)}–${speed.say(w.max_kn)}`
                        : "–"}
                    </td>
                  )}
                  {rated && (
                    <td className={s.td({ className: s.narrow() })}>
                      {r.rating
                        ? `${r.rating.wing.own ?? r.rating.wing.recommended} m²`
                        : "–"}
                    </td>
                  )}
                  <td className={s.td()}>
                    {r.hour.waves?.height_m == null
                      ? "–"
                      : heights.figure(r.hour.waves.height_m)}
                  </td>
                  <td className={s.td({ className: s.narrow() })}>
                    {r.hour.waves?.period_s == null
                      ? "–"
                      : `${r.hour.waves.period_s} s`}
                  </td>
                  {turns.length > 0 && (
                    <td className={s.td()} data-tide-cell>
                      {tideHeightAt(turns, r.time)?.toFixed(1) ?? "–"} m
                      {d !== null && (
                        <span className="text-ink-2">
                          {" "}
                          · launch {d.toFixed(1)} m
                        </span>
                      )}
                    </td>
                  )}
                  <td className={s.td({ className: s.narrow() })}>
                    {r.hour.weather?.air_c == null
                      ? "–"
                      : `${Math.round(r.hour.weather.air_c)}°`}
                  </td>
                  <td
                    className={s.td({ className: s.narrow() })}
                    data-rain-cell
                  >
                    {wet === null
                      ? "–"
                      : wet < DRY_MM_PER_HOUR
                        ? "0"
                        : wet < 0.1
                          ? "<0.1"
                          : wet.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * An hour's stars in the table: an orange or red Met Éireann warning, or a
 * notice against bathing, stands where the stars were, as its square and one
 * word ("Orange warning", "Water"); a yellow warning or any other notice
 * rides beside them, the square alone. A press says why, in words
 * (ui/RatingTip.tsx).
 */
function StarsCell({
  row,
  forecast,
}: {
  row: SpotRow;
  forecast: SpotForecast;
}) {
  const warned = (row.warning?.ids ?? [])
    .map((id) => forecast.warnings.items.find((item) => item.id === id))
    .filter((item) => item !== undefined)
    .map(warningName)
    .join("; ");
  const watered =
    (row.water?.ids ?? [])
      .map((id) => forecast.water_quality.items.find((item) => item.id === id))
      .filter((item) => item !== undefined)
      .map(noticeWords)
      .join("; ") || "Bathing water notice";
  const taken = standIn(row);
  const beside = besideMark(row);
  const warningWords = row.warning
    ? warned || `${LEVEL_LABEL[row.warning.level]} warning`
    : "";
  const label = `${clock(row.time)}: ${
    taken?.level === "water"
      ? `no stars: ${watered}`
      : taken
        ? `no stars: ${warningWords}`
        : row.rating
          ? starsText(row.rating)
          : row.hour.daylight
            ? "no wind reading"
            : "dark, not rated"
  }${row.warning && !row.warning.replaces_rating ? `; ${warningWords}` : ""}${row.water && taken?.level !== "water" ? `; ${watered}` : ""}`;
  return (
    <td
      className={styles().td()}
      data-stars={row.rating ? row.rating.stars : undefined}
      data-hour-warning={row.warning?.level}
      data-hour-water={
        row.water
          ? row.water.replaces_rating
            ? "replaces"
            : "beside"
          : undefined
      }
    >
      <RatingTip
        label={label}
        detail={
          <div className="grid gap-1.5" data-hour-tip>
            {row.warning && (
              <p className="m-0 flex items-center gap-1.5" data-tip-warning>
                <NoticeMark level={row.warning.level} />
                <span>
                  {warningWords}
                  {row.warning.replaces_rating
                    ? ": no stars while it is in force."
                    : ": the stars stand beside it."}
                </span>
              </p>
            )}
            {row.water && (
              <p className="m-0 flex items-center gap-1.5" data-tip-water>
                <NoticeMark
                  level={row.water.replaces_rating ? "water" : "water-advice"}
                />
                <span>
                  {watered}
                  {row.water.replaces_rating
                    ? ": no stars while it stands."
                    : ": the stars stand beside it."}
                </span>
              </p>
            )}
            <p className="m-0 font-semibold">
              {taken?.level === "water"
                ? "Bathing water notice."
                : taken
                  ? "Met Éireann warning."
                  : row.rating
                    ? starsText(row.rating)
                    : row.hour.daylight
                      ? "No wind reading."
                      : "Dark, not rated."}
            </p>
            {!!row.rating?.reasons.length && (
              <ul className="m-0 pl-4">
                {row.rating.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
          </div>
        }
      >
        {taken ? (
          <NoticeMark level={taken.level}>{taken.word}</NoticeMark>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            {row.rating ? <Stars n={row.rating.stars} size={12} /> : "–"}
            {beside && <NoticeMark level={beside} />}
          </span>
        )}
      </RatingTip>
    </td>
  );
}
