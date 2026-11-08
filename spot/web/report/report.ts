/**
 * The spot report's own sums (spot/web/SpotApp.tsx draws them): which row is
 * now, each day as a card, the curve through a series, and the light left.
 * Pure, so they are tested without a page.
 */
import { LEVEL_LABEL, type WarningLevel } from "../../../force5/src/warnings";
import { NOTICE_MARK } from "../../../force5/src/waterQuality";
import type { SpotDay, SpotRow } from "../spot";
import { dayNames } from "../spot";

/**
 * What stands where an hour's stars would be: an orange or red Met Éireann
 * warning ("Orange warning"), or else a notice against bathing ("Water").
 * The kit's NoticeMark draws it, the level's square and the word.
 */
export interface StandIn {
  level: Exclude<WarningLevel, "yellow"> | "water";
  word: string;
}

const STAND_IN_RANK: Record<StandIn["level"], number> = {
  water: 1,
  orange: 2,
  red: 3,
};

/** What took a row's stars away, or null where nothing did. */
export function standIn(
  row: Pick<SpotRow, "warning" | "water">,
): StandIn | null {
  const warning = row.warning;
  if (warning?.replaces_rating && warning.level !== "yellow")
    return {
      level: warning.level,
      word: `${LEVEL_LABEL[warning.level]} warning`,
    };
  if (row.water?.replaces_rating) return { level: "water", word: NOTICE_MARK };
  return null;
}

/**
 * What rides beside a row's stars and leaves them: a yellow warning, or a
 * notice that does not keep anyone out of the water. The square alone.
 */
export function besideMark(
  row: Pick<SpotRow, "warning" | "water">,
): "yellow" | "water-advice" | null {
  if (row.warning && !row.warning.replaces_rating) return "yellow";
  if (row.water && !row.water.replaces_rating) return "water-advice";
  return null;
}

/** The row that covers a moment: the last that starts at or before it. */
export function rowAt(rows: readonly SpotRow[], time: number): SpotRow | null {
  let at: SpotRow | null = null;
  for (const row of rows) {
    if (row.time <= time) at = row;
    else break;
  }
  return at ?? rows[0] ?? null;
}

/** One day's card in the week: its stars, its wind, its small curve. */
export interface DayCard {
  date: string;
  /** "Today", "Sun"… */
  label: string;
  /** The day of the month. */
  day: number;
  /** The best stars of the day's daylight hours, 0 with none. */
  best: number;
  lo: number | null;
  hi: number | null;
  /** The wind through the day, for the small curve: hours from midnight, knots. */
  spark: { hour: number; kn: number }[];
  /** The strongest warning or notice that took a daylight hour's stars. */
  notice: StandIn | null;
}

export function dayCard(day: SpotDay, now: number, midnight: number): DayCard {
  const light = day.rows.filter((r) => r.hour.daylight && r.hour.wind);
  const names = dayNames(day.date, now);
  return {
    date: day.date,
    label: names.relative === "Today" ? "Today" : names.short,
    day: Number(day.date.slice(8, 10)),
    best: Math.max(0, ...light.map((r) => r.rating?.stars ?? 0)),
    lo: day.windMin === null ? null : Math.round(day.windMin),
    hi: day.windMax === null ? null : Math.round(day.windMax),
    spark: day.rows
      .filter((r) => r.hour.wind)
      .map((r) => ({
        hour: (r.time - midnight) / 3600000,
        kn: r.hour.wind!.wind_kn,
      })),
    notice: day.rows
      .filter((r) => r.hour.daylight)
      .map(standIn)
      .reduce<StandIn | null>(
        (top, x) =>
          x && (!top || STAND_IN_RANK[x.level] > STAND_IN_RANK[top.level])
            ? x
            : top,
        null,
      ),
  };
}

/** A smooth curve through points, as cubic Béziers (Catmull-Rom). */
export function smoothPath(
  points: readonly (readonly [number, number])[],
): string {
  if (!points.length) return "";
  const f = (n: number) => Number(n.toFixed(1));
  let d = `M${f(points[0][0])},${f(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i - 1] ?? points[i];
    const b = points[i];
    const c = points[i + 1];
    const e = points[i + 2] ?? c;
    d +=
      `C${f(b[0] + (c[0] - a[0]) / 6)},${f(b[1] + (c[1] - a[1]) / 6)}` +
      ` ${f(c[0] - (e[0] - b[0]) / 6)},${f(c[1] - (e[1] - b[1]) / 6)}` +
      ` ${f(c[0])},${f(c[1])}`;
  }
  return d;
}
