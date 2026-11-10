/**
 * A place on the spot finder, a row: its picture from above, small and
 * square, with the ride rose on it; beside it the name and county with the
 * heart a rider keeps it by, and the day shown (today, or the day stepped to)
 * hour by hour as four bars, the wind, the waves, the sky and the stars
 * (`DayBars`), whatever the map beside the list shows.
 *
 * Pressing the card, its picture too, opens the place's own page (the
 * owner's ruling of 2026-11-02: the chart is a button away in the top bar);
 * only the star and the bars, which pick an hour, do anything else.
 *
 * The picture is the spot page's own, cut from the chart's satellite
 * composites (spot/web/satellite.ts), loaded lazily as the card scrolls in;
 * the rose is the loupe's (force5/src/focus.ts), at the loupe's distance,
 * for the hour picked on the day's row, or the hour the day stands at.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Heart } from "lucide-react";
import { faintRose, loupeRose, roseScale } from "../../force5/src/focus";
import { Loupe } from "../../shared/web/Loupe";
import { useSize } from "../../shared/web/useSize";
import { speedShort, unitLabel, waveFigure } from "../../force5/src/units";
import {
  measuredAt,
  pairedName,
  type Paired,
  type WindReading,
} from "../../force5/src/windObs";
import { windCss } from "../../force5/src/windCss";
import { spotHref } from "../../force5/src/siteNav";
import type { Rider } from "../../force5/src/stars";
import type { Units, WaveUnits } from "../../force5/src/units";
import type { Spot } from "../../force5/src/weather";
import { Button } from "../../ui/Button";
import { Tag } from "../../ui/Tag";
import { Skeleton } from "../../ui/Skeleton";
import { tv } from "../../ui/tv";
import {
  inFrame,
  lift,
  loadSpotPictures,
  spotPicture,
  type SpotPictures,
} from "../../spot/web/satellite";
import type { PlaceHour } from "../ratings";
import { clock, type StripColumn } from "../strip";
import { HOUR, everyThird, type Best, type DayRow } from "./finder";
import type { Readings } from "./useReadings";

export const cardStyles = tv({
  slots: {
    // A row on a quiet card: the picture small and square, so the 10 m
    // satellite stays sharp, beside the name and the day's wind, waves, sky
    // and stars as four gradients.
    card: [
      "group/card relative grid min-w-0 cursor-pointer grid-cols-card gap-x-3.5 rounded-surface bg-sunken p-2.5",
      "transition duration-fast motion-reduce:transition-none hover:inset-ring-1 hover:inset-ring-line-strong",
    ],
    pictureBox: "relative block w-full self-start",
    picture: "relative aspect-square overflow-hidden rounded-control bg-sea-1",
    framed: "rounded-control",
    image: "absolute inset-0 block size-full object-cover",
    at: "pointer-events-none absolute right-1 bottom-1 px-1.5 py-0 text-eyebrow font-semibold",
    km: "pointer-events-none absolute top-1.5 left-1.5 px-1.5 py-0 text-eyebrow font-semibold",
    body: "flex min-w-0 flex-col gap-2",
    head: "flex items-center gap-2",
    names: "flex min-w-0 flex-1 flex-col",
    name: "m-0 line-clamp-2 min-w-0 font-body text-prose leading-tight font-semibold text-ink",
    nameLink:
      "rounded-control text-ink no-underline not-disabled:hover:text-chart-magenta",
    meta: "truncate font-body text-body text-ink-muted",
    // The wind measured now at the nearest station, after the county: a
    // small square of the readings' gold, the figures, and where.
    measured: "mt-0.5 truncate font-body text-caption text-ink-2",
    measuredMark:
      "mr-1.5 inline-block size-1.5 rounded-full bg-buoy align-middle",
    measuredFigure: "font-semibold text-ink tabular-nums",
    star: "self-start",
    bars: "grid grid-cols-bars items-center gap-x-1.5 gap-y-1",
    barName: "font-body text-caption font-medium text-ink-muted",
    // The wind, the waves and the sky each a bar with figures in it; the
    // stars a thin one under them.
    bar: "relative h-3.5 cursor-pointer rounded-full",
    starsBar: "h-1.5",
    // Water the open sea's waves do not reach: the row kept, empty.
    noBar: "bg-line",
    barNum:
      "pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 font-body text-caption leading-none font-semibold text-photo-shade",
    // A figure at either end of a bar, held inside it rather than centred
    // over the rounded end.
    barNumFirst: "left-1 translate-x-0",
    barNumLast: "right-1 left-auto translate-x-0",
    // A wave's figure on the deep end of the ramp, which is the light theme's
    // high seas and the dark theme's flat ones.
    barNumLight: "text-photo-line",
    barNumDarkLight: "dark:text-photo-line",
    barNumDarkShade: "dark:text-photo-shade",
    // A notch over the bar, clear of the figures in it: ink for the hour now,
    // magenta for the day's best on a day ahead.
    tick: "pointer-events-none absolute -top-1 h-1 w-0.5 -translate-x-1/2 rounded-t-full",
    tickNow: "bg-ink",
    tickBest: "bg-chart-magenta",
    hours: "relative h-3.5 font-body text-caption text-ink-muted",
    hour: "absolute -translate-x-1/2",
    // A card while the places are read: the shapes of its parts, each the
    // size the card's own will be, so nothing moves when it lands.
    ghostPicture: "aspect-square min-h-0 w-full",
    ghostName: "h-4 w-40 max-w-full",
    ghostWords: "m-0 font-body text-prose text-ink-muted",
    ghostMeta: "w-24",
    ghostStar: "size-control-sm shrink-0 pointer-coarse:size-touch",
    ghostBar: "h-3.5 min-h-0 w-full rounded-full",
    ghostThin: "h-1.5 min-h-0 w-full rounded-full",
  },
});

/** The list of pictures, read once a page; null until it is, and with none published. */
function useSpotPictures(): SpotPictures | null {
  const [pictures, setPictures] = useState<SpotPictures | null>(null);
  useEffect(() => {
    let live = true;
    void loadSpotPictures().then((p) => live && setPictures(p));
    return () => {
      live = false;
    };
  }, []);
  return pictures;
}

/**
 * The place from above, north up, with the ride rose on it for the hour. No
 * picture published (or one that will not load): the rose on the sea's tint.
 */
export function SpotPicture({
  spot,
  hour,
  rider,
  units,
  className,
  children,
}: {
  spot: Spot;
  hour: PlaceHour | null;
  rider: Rider;
  units: Units;
  className?: string;
  children?: ReactNode;
}) {
  const s = cardStyles();
  const pictures = useSpotPictures();
  const picture = pictures ? spotPicture(pictures, spot) : null;
  const [failed, setFailed] = useState(false);
  const [ref, size] = useSize<HTMLDivElement>();
  const shown = picture && !failed ? picture : null;
  const place = size && shown ? inFrame(shown, size.width, size.height) : null;
  const short = size ? Math.min(size.width, size.height) : 0;
  // The loupe's distance, where the picture says how far that is, held to
  // a third of the frame so the place around it shows; a third of it with
  // no picture to measure against.
  const r = place
    ? Math.min(
        0.33 * short,
        roseScale(units).metres / place.metresPerScreenPixel,
      )
    : 0.33 * short;
  const loupe =
    hour && hour.windKn !== null
      ? loupeRose(rider, hour, spot.facing ?? null, units)
      : null;
  const faint = hour ? faintRose(rider, hour, spot.facing ?? null) : null;
  return (
    <div
      className={s.picture({ className })}
      ref={ref}
      data-spot-picture
      data-rose-from={loupe ? Math.round(loupe.rose.windFrom) : undefined}
    >
      {shown && (
        <img
          className={s.image({ className: lift(shown) })}
          src={shown.urls.high}
          width={shown.width}
          height={shown.height}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
      {size && r > 0 && (
        <Loupe
          width={size.width}
          height={size.height}
          cx={place ? place.x : size.width / 2}
          cy={place ? place.y : size.height / 2}
          r={r}
          loupe={loupe}
          faint={faint}
          scale={null}
          small
          className="pointer-events-none"
        />
      )}
      {children}
    </div>
  );
}

/** The heart a rider saves a place with, as the market saves a listing. */
export function SaveToggle({
  spot,
  on,
  onToggle,
  className,
}: {
  spot: Spot;
  on: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <Button
      variant="quiet"
      size="sm"
      icon
      pressed={on ? "worded" : false}
      className={className}
      aria-label={`Save ${spot.name}`}
      title={on ? "Saved" : "Save"}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <Heart
        size={16}
        strokeWidth={1.5}
        fill={on ? "currentColor" : "none"}
        aria-hidden="true"
      />
    </Button>
  );
}

export interface SpotCardProps {
  spot: Spot;
  km: number | null;
  row: readonly PlaceHour[] | undefined;
  strip: readonly StripColumn[];
  /** The day drawn hour by hour: today, or the one stepped to. */
  day: DayRow | null;
  /** Whether the day is today. */
  isToday: boolean;
  readings: Readings;
  /** The hour picked on the day's row, or null for the hour it stands at. */
  picked: number | null;
  /** The hour ringed on the day's row: the one picked, or the one it stands at. */
  shown: number;
  /** The strip's column the picture's rose is for, or null with none. */
  roseAt: number | null;
  now: number;
  rider: Rider;
  units: Units;
  waveUnits: WaveUnits;
  starred: boolean;
  phone: boolean;
  reducedMotion: boolean;
  onToggleStar: () => void;
  onPick: (time: number) => void;
  /** Its best on the day shown, which put it where it is on the list. */
  best: Best;
  /**
   * On today, its nearest weather station or buoy and the wind it measured
   * last, while fresh (force5/src/windObs.ts); else null.
   */
  measured?: { paired: Paired; reading: WindReading } | null;
}

/** A card on the list. */
export function SpotCard(props: SpotCardProps) {
  const {
    spot,
    km,
    row,
    day,
    isToday,
    picked,
    shown,
    roseAt,
    rider,
    units,
    waveUnits,
    starred,
    onToggleStar,
    onPick,
    best,
    measured = null,
  } = props;
  const s = cardStyles();
  const href = spotHref(spot.id);
  const where = [spot.county ? `Co. ${spot.county}` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <article
      className={s.card()}
      data-spot-card={spot.id}
      data-best={best.stars}
      data-best-day={best.day ?? undefined}
      aria-label={spot.name}
      onClick={(event) => {
        if ((event.target as Element).closest("button, a, [data-bar]")) return;
        window.location.assign(href);
      }}
    >
      <div className={s.pictureBox()} data-card-picture>
        <SpotPicture
          spot={spot}
          hour={roseAt === null ? null : (row?.[roseAt] ?? null)}
          rider={rider}
          units={units}
          className={s.framed()}
        >
          {km !== null && (
            <Tag tone="glass" className={s.km()} data-km>
              {km < 0.5 ? "<1 km" : `${Math.round(km)} km`}
            </Tag>
          )}
          {(picked !== null || !isToday) && (
            <Tag
              tone="glass"
              className={s.at()}
              data-picked-hour={picked !== null || undefined}
              data-rose-hour
            >
              {clock(shown)}
            </Tag>
          )}
        </SpotPicture>
      </div>
      <div className={s.body()}>
        <div className={s.head()}>
          <div className={s.names()}>
            <h3 className={s.name()}>
              <a className={s.nameLink()} href={href}>
                {spot.name}
              </a>
            </h3>
            {where && <span className={s.meta()}>{where}</span>}
            {measured && (
              <span
                className={s.measured()}
                data-card-measured={measured.paired.station.id}
                title={`Measured at ${pairedName(measured.paired)}, ${measuredAt(measured.reading.time)}`}
              >
                <i className={s.measuredMark()} aria-hidden="true" />
                Now{" "}
                <b className={s.measuredFigure()}>
                  {speedShort(measured.reading.windKn, units)}
                  {measured.reading.gustKn !== null &&
                    ` g${speedShort(measured.reading.gustKn, units)}`}
                </b>
                {units === "bft" ? "" : ` ${unitLabel(units)}`}
                <span className="sr-only"> measured at</span>
                <span aria-hidden="true"> · </span>
                {pairedName(measured.paired)}
              </span>
            )}
          </div>
          <SaveToggle
            spot={spot}
            on={starred}
            onToggle={onToggleStar}
            className={s.star()}
          />
        </div>
        {day && (
          <DayBars
            day={day}
            row={row}
            readings={props.readings}
            shown={shown}
            isToday={isToday}
            units={units}
            waveUnits={waveUnits}
            onPick={onPick}
          />
        )}
      </div>
    </article>
  );
}

const STARS_CSS = [
  "var(--color-line)",
  "var(--color-stars-1)",
  "var(--color-stars-2)",
  "var(--color-stars-3)",
  "var(--color-stars-4)",
  "var(--color-stars-5)",
];

/** A value on a ramp of tokens, between the two stops either side of it. */
function rampCss(stops: readonly (readonly [number, string])[], v: number) {
  if (v <= stops[0][0]) return `var(${stops[0][1]})`;
  for (let i = 1; i < stops.length; i++) {
    const [to, name] = stops[i];
    if (v > to) continue;
    const [from, below] = stops[i - 1];
    const share = Math.round(((v - from) / (to - from)) * 100);
    return `color-mix(in oklab, var(${name}) ${share}%, var(${below}))`;
  }
  return `var(${stops[stops.length - 1][1]})`;
}

/** The waves' height ramp, metres (ui/theme.css `--color-waves-*`). */
const WAVES: readonly (readonly [number, string])[] = [
  [0, "--color-waves-m0"],
  [0.5, "--color-waves-m05"],
  [1, "--color-waves-m1"],
  [2, "--color-waves-m2"],
  [3, "--color-waves-m3"],
  [5, "--color-waves-m5"],
  [8, "--color-waves-m8"],
];

/** The sky by its cloud, per cent (ui/theme.css `--color-sky-*`). */
const SKY: readonly (readonly [number, string])[] = [
  [0, "--color-sky-c0"],
  [30, "--color-sky-c30"],
  [55, "--color-sky-c55"],
  [78, "--color-sky-c78"],
  [100, "--color-sky-c100"],
];

export const wavesCss = (metres: number) => rampCss(WAVES, metres);
export const skyCss = (cloud: number) => rampCss(SKY, cloud);

/**
 * The rain in an hour as a strip under the sky: none under 0.1 mm, then the
 * weather's rain blue, stronger as it gets heavier (light under 0.5 mm,
 * moderate under 2 mm, then heavy).
 */
export function rainCss(mm: number | null | undefined): string {
  if (mm == null || mm < 0.1) return "transparent";
  const share = mm < 0.5 ? 45 : mm < 2 ? 70 : 100;
  return `color-mix(in srgb, var(--color-weather-rain) ${share}%, transparent)`;
}

/** How tall the rain's strip is, under the sky's bar. */
const RAIN_STRIP = "4px";

/**
 * The day's hours, first light to last, as four bars: the wind in its own
 * colours with its speed every three hours; the waves' height in theirs, with
 * the metres, kept empty on water the open sea's waves do not reach; the sky,
 * yellow for a clear sky to grey under cloud, with the air's temperature and
 * the rain as a blue strip along its foot; and the stars in theirs. A notch
 * marks the hour shown, where it is on the row: none for an hour off either
 * end (today after dark, or before first light), never the last hour standing
 * in for it. A press on any bar picks the hour under it, of this day's, on
 * every card.
 */
function DayBars({
  day,
  row,
  readings,
  shown,
  isToday,
  units,
  waveUnits,
  onPick,
}: {
  day: DayRow;
  row: readonly PlaceHour[] | undefined;
  readings: Readings;
  shown: number;
  isToday: boolean;
  units: Units;
  waveUnits: WaveUnits;
  onPick: (time: number) => void;
}) {
  const s = cardStyles();
  const hours = day.hours;
  if (!hours.length) return null;
  const n = hours.length;
  const pos = (i: number) => `${(((i + 0.5) / n) * 100).toFixed(1)}%`;
  const at = (i: number) => {
    const k = hours[i].at;
    return k === null ? null : (row?.[k] ?? null);
  };
  /** A reading at the row's `i`th hour, or null. */
  const read = <T,>(values: readonly (T | null)[], i: number): T | null => {
    const k = hours[i].at;
    return k === null ? null : (values[k] ?? null);
  };
  const gradient = (colour: (i: number) => string) =>
    `linear-gradient(90deg, ${hours.map((_, i) => `${colour(i)} ${pos(i)}`).join(", ")})`;
  const wind = gradient((i) => {
    const h = at(i);
    return h?.windKn == null ? "var(--color-line)" : windCss(h.windKn);
  });
  const waves = gradient((i) => {
    const sea = read(readings.sea, i);
    return sea ? wavesCss(sea.height) : "var(--color-line)";
  });
  const sky = gradient((i) => {
    const cloud = read(readings.cloud, i);
    return cloud === null ? "var(--color-line)" : skyCss(cloud);
  });
  const raining = hours.some((_, i) => (read(readings.rain, i) ?? 0) >= 0.1);
  const skyLayers = raining
    ? `${gradient((i) => rainCss(read(readings.rain, i)))} bottom / 100% ${RAIN_STRIP} no-repeat, ${sky}`
    : sky;
  const stars = gradient((i) => STARS_CSS[at(i)?.rating?.stars ?? 0]);
  const marked = everyThird(hours);
  // The column whose hour (or step, where the run is coarser) holds it.
  const shownAt = hours.findIndex(
    (h, i) => h.time <= shown && shown < (hours[i + 1]?.time ?? h.time + HOUR),
  );
  const pick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const box = event.currentTarget.getBoundingClientRect();
    const i = Math.min(
      n - 1,
      Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * n)),
    );
    onPick(hours[i].time);
  };
  const tick =
    shownAt < 0 ? null : (
      <i
        className={s.tick({ className: isToday ? s.tickNow() : s.tickBest() })}
        style={{ left: pos(shownAt) }}
        data-shown-tick
      />
    );
  /** A figure every three hours, where `say` has one for the hour. */
  const figures = (
    say: (i: number) => { text: string; className?: string } | null,
  ) =>
    hours.map((h, i) => {
      const figure = marked[i] ? say(i) : null;
      const end = i === 0 ? s.barNumFirst() : i === n - 1 ? s.barNumLast() : "";
      return figure ? (
        <b
          key={h.time}
          className={s.barNum({ className: [figure.className, end].join(" ") })}
          style={end ? undefined : { left: pos(i) }}
        >
          {figure.text}
        </b>
      ) : null;
    });
  return (
    <div
      className={s.bars()}
      aria-busy={row === undefined || undefined}
      data-day-bars={day.date}
    >
      <span className={s.barName()}>Wind</span>
      <div
        className={s.bar()}
        style={{ background: wind }}
        onClick={pick}
        data-bar="wind"
      >
        {figures((i) => {
          const p = at(i);
          return p?.windKn == null
            ? null
            : { text: speedShort(p.windKn, units) };
        })}
        {tick}
      </div>
      <span className={s.barName()}>Waves</span>
      {readings.inland ? (
        <div
          className={s.bar({ className: s.noBar() })}
          onClick={pick}
          title="The open sea's waves do not reach this water"
          data-bar="waves"
          data-inland
        >
          {tick}
        </div>
      ) : (
        <div
          className={s.bar()}
          style={{ background: waves }}
          onClick={pick}
          data-bar="waves"
        >
          {figures((i) => {
            const sea = read(readings.sea, i);
            if (!sea) return null;
            const h = sea.height;
            return {
              text: waveFigure(h, waveUnits),
              className: [
                h >= 2.2 ? s.barNumLight() : "",
                h >= 1.6 ? s.barNumDarkShade() : s.barNumDarkLight(),
              ].join(" "),
            };
          })}
          {tick}
        </div>
      )}
      <span className={s.barName()}>Sky</span>
      <div
        className={s.bar()}
        style={{ background: skyLayers }}
        onClick={pick}
        data-bar="sky"
        data-rain={raining || undefined}
      >
        {figures((i) => {
          const air = read(readings.air, i);
          return air === null ? null : { text: `${Math.round(air)}°` };
        })}
        {tick}
      </div>
      <span className={s.barName()}>Stars</span>
      <div
        className={s.bar({ className: s.starsBar() })}
        style={{ background: stars }}
        onClick={pick}
        data-bar="stars"
      >
        {tick}
      </div>
      <span />
      <div className={s.hours()} aria-hidden="true">
        {hours.map((h, i) =>
          marked[i] ? (
            <span key={h.time} className={s.hour()} style={{ left: pos(i) }}>
              {clock(h.time).slice(0, 2)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

/**
 * A card's shape while the places themselves are read, with what is loading
 * said on the first (`words`). It is hidden from a screen reader: the list
 * that holds it says it is busy.
 */
export function CardSkeleton({ words }: { words?: string }) {
  const s = cardStyles();
  return (
    <div
      className={s.card({ className: "cursor-default" })}
      aria-hidden="true"
      data-card-skeleton
    >
      <Skeleton shape="block" className={s.ghostPicture()} />
      <div className={s.body()}>
        <div className={s.head()}>
          <div className={s.names()}>
            {words ? (
              <p className={s.ghostWords()}>{words}</p>
            ) : (
              <Skeleton className={s.ghostName()} />
            )}
            <Skeleton className={s.ghostMeta()} />
          </div>
          <Skeleton shape="circle" className={s.ghostStar()} />
        </div>
        <div className={s.bars()}>
          <span className={s.barName()}>Wind</span>
          <Skeleton shape="block" className={s.ghostBar()} />
          <span className={s.barName()}>Waves</span>
          <Skeleton shape="block" className={s.ghostBar()} />
          <span className={s.barName()}>Sky</span>
          <Skeleton shape="block" className={s.ghostBar()} />
          <span className={s.barName()}>Stars</span>
          <Skeleton shape="block" className={s.ghostThin()} />
          <span />
          <div className={s.hours()} />
        </div>
      </div>
    </div>
  );
}
