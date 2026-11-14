/**
 * The strip of hours a finger scrubs (src/TimeStrip.tsx): what is pure about
 * it. The hours stand a fixed width apart, about eight across a phone, and
 * scroll under a playhead that stays in the middle; the time is wherever the
 * playhead is. A notch for every hour, the hour's figure every third, and the
 * day's name where a day begins.
 *
 * Times are UTC milliseconds, and every label is Irish time.
 */
import type { Fold } from "../shared/web/afterDark";
import { clock, dayShort, irishDate, irishHour, irishTomorrow } from "./strip";

const HOUR = 3600000;

/** About this many hours across a phone. */
export const HOURS_ACROSS = 8;
/** The width of an hour: never so narrow its notches crowd, nor so wide a day will not fit a desk's screen. */
export const MIN_HOUR_PX = 40;
export const MAX_HOUR_PX = 60;
/** Every third hour has its figure under it. */
export const LABEL_EVERY = 3;

/**
 * How wide an hour is on a strip `width` wide: about eight hours across a
 * phone, and on a wider strip as many more as fit at the widest hour (a day
 * or so across a desk's screen), never a week squeezed in.
 */
export function hourWidth(width: number): number {
  if (!(width > 0)) return MAX_HOUR_PX;
  return Math.min(MAX_HOUR_PX, Math.max(MIN_HOUR_PX, width / HOURS_ACROSS));
}

/** One hour's notch on the strip. */
export interface Notch {
  time: number;
  /** "hour", a plain notch; "label", one with its figure; "day", the first of a day. */
  kind: "hour" | "label" | "day";
  /** The figure or the day's name under it, or "" for a plain notch. */
  text: string;
}

/**
 * The strip's notches from `first` to `last`, one for every whole hour, each
 * third with its figure ("09", "12") and the first hour of each day with the
 * day's name ("Mon 14") in its figure's place. On a strip with hours folded
 * out (`line`, the night hidden) the hours folded out have no notch, and the
 * first hour kept of a day is the one that names it.
 */
export function notches(
  first: number,
  last: number,
  line?: Pick<Fold, "kept">,
): Notch[] {
  const out: Notch[] = [];
  if (!(last >= first)) return out;
  let date = irishDate(first);
  for (let t = Math.ceil(first / HOUR) * HOUR; t <= last; t += HOUR) {
    if (line && !line.kept(t)) continue;
    const day = irishDate(t);
    const newDay = day !== date;
    date = day;
    const hour = irishHour(t);
    out.push(
      newDay
        ? { time: t, kind: "day", text: dayWords(t) }
        : hour % LABEL_EVERY === 0
          ? { time: t, kind: "label", text: clock(t).slice(0, 2) }
          : { time: t, kind: "hour", text: "" },
    );
  }
  return out;
}

/** "Mon 14": a day's name where it begins on the strip. */
export function dayWords(time: number): string {
  return `${dayShort(time)} ${Number(irishDate(time).slice(8))}`;
}

/** "Today 13:00", "Tomorrow 09:00", "Sat 18:00". */
export function hourWords(time: number, now: number): string {
  const date = irishDate(time);
  const day =
    date === irishDate(now)
      ? "Today"
      : date === irishTomorrow(now)
        ? "Tomorrow"
        : dayShort(time);
  return `${day} ${clock(time)}`;
}

/** The index of the time in `times` (ascending) nearest `time`. */
export function nearestIndex(times: readonly number[], time: number): number {
  let lo = 0;
  let hi = times.length - 1;
  if (hi < 0) return -1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] < time) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && time - times[lo - 1] <= times[lo] - time) return lo - 1;
  return lo;
}

/**
 * The stop a day on from `at` (`step` 1) or back (-1): the one nearest the
 * same time a day away, held inside the strip.
 */
export function dayAway(
  times: readonly number[],
  at: number,
  step: number,
): number {
  if (!times.length) return -1;
  const from = times[Math.max(0, Math.min(times.length - 1, at))];
  return nearestIndex(times, from + step * 24 * HOUR);
}
