import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Button } from "../ui/Button";
import { clock, dayShort, irishDate, irishHour, irishTomorrow } from "./strip";

/** The hours the bar runs over, Irish time: early morning to late evening. */
export const FIRST_HOUR = 6;
export const LAST_HOUR = 21;
/** The hours named under the track, every third. */
const MARKS = [6, 9, 12, 15, 18, 21];
/** How long an hour stands while the bar plays. */
const PLAY_MS = 800;
const HOUR = 3600000;

/**
 * The instants of a day's hours on the bar, 06:00 to 21:00 Irish time, read
 * hour by hour from the day's own clock so that a change of the clocks moves
 * none of them.
 */
export function dayHours(date: string): number[] {
  const from = Date.parse(`${date}T00:00:00Z`) - 2 * HOUR;
  const out: number[] = [];
  for (let t = from; t < from + 30 * HOUR; t += HOUR) {
    if (irishDate(t) !== date) continue;
    const h = irishHour(t);
    if (
      h >= FIRST_HOUR &&
      h <= LAST_HOUR &&
      !out.some((o) => irishHour(o) === h)
    )
      out.push(t);
  }
  return out;
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

/**
 * The day's hours under the map's layer chips (src/MapDock.tsx): play, the
 * hour shown in words, and a slim track from 06 to 21 with every third hour
 * under it. It scrubs the day the list shows; the cards and the map share the
 * hour it is at, both ways. A slider to the keys and a screen reader: the
 * arrows step an hour, Page Up and Page Down three, Home and End go to the
 * ends. Play steps on an hour at a time to 21:00 and stops there.
 *
 * On a narrow screen, where the list's head is out of sight under the map,
 * the day steps on the bar itself: ‹ before the hour's words and › after
 * them (`onDay`), each off where there is no day past it.
 */
export default function HourBar({
  time,
  now,
  onTime,
  onDay,
}: {
  /** The hour shown. */
  time: number;
  now: number;
  /** An hour of the same day, chosen. */
  onTime: (time: number) => void;
  /** A day back or on, and whether there is one either way; none, no steps. */
  onDay?: { step: (by: -1 | 1) => void; back: boolean; on: boolean };
}) {
  const date = irishDate(time);
  const hours = useMemo(() => dayHours(date), [date]);
  const hour = irishHour(time);
  // Where the hour stands on the track; an hour off either end at that end.
  const index = hours.findIndex((h) => irishHour(h) === hour);
  const shown = index >= 0 ? index : hour < FIRST_HOUR ? 0 : hours.length - 1;
  const share = hours.length > 1 ? shown / (hours.length - 1) : 0;
  const words = hourWords(time, now);

  const [playing, setPlaying] = useState(false);
  const latest = useRef({ shown, hours, onTime });
  latest.current = { shown, hours, onTime };
  useEffect(() => {
    if (!playing) return;
    const step = window.setInterval(() => {
      const { shown, hours, onTime } = latest.current;
      if (shown >= hours.length - 1) return setPlaying(false);
      onTime(hours[shown + 1]);
    }, PLAY_MS);
    return () => window.clearInterval(step);
  }, [playing]);
  // Another day is another bar: whatever played stops.
  useEffect(() => setPlaying(false), [date]);
  const play = () => {
    if (playing) return setPlaying(false);
    if (shown >= hours.length - 1) onTime(hours[0]);
    setPlaying(true);
  };

  const track = useRef<HTMLDivElement>(null);
  const choose = (i: number) => {
    const to = hours[Math.min(Math.max(i, 0), hours.length - 1)];
    if (to !== undefined && to !== time) onTime(to);
  };
  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = track.current?.getBoundingClientRect();
    if (!box || !box.width) return;
    const x = Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1);
    choose(Math.round(x * (hours.length - 1)));
  };
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    const to =
      event.key === "ArrowLeft" || event.key === "ArrowDown"
        ? shown - 1
        : event.key === "ArrowRight" || event.key === "ArrowUp"
          ? shown + 1
          : event.key === "PageDown"
            ? shown - 3
            : event.key === "PageUp"
              ? shown + 3
              : event.key === "Home"
                ? 0
                : event.key === "End"
                  ? hours.length - 1
                  : null;
    if (to === null) return;
    event.preventDefault();
    // The keys belong to the bar here, not to the map behind it.
    event.stopPropagation();
    setPlaying(false);
    choose(to);
  };

  return (
    <div className="hour-bar" data-hour-bar data-day={date}>
      <Button
        variant="quiet"
        size="sm"
        icon
        className="hb-play"
        aria-label={playing ? "Pause" : "Play the hours"}
        onClick={play}
        data-hour-play
      >
        {playing ? (
          <Pause size={15} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Play size={15} strokeWidth={1.75} aria-hidden="true" />
        )}
      </Button>
      {onDay && (
        <Button
          variant="quiet"
          size="sm"
          icon
          className="hb-day"
          aria-label="The day before"
          disabled={!onDay.back}
          onClick={() => onDay.step(-1)}
          data-hour-day="back"
        >
          <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        </Button>
      )}
      <span className="hb-when" data-hour-when aria-hidden="true">
        {words}
      </span>
      {onDay && (
        <Button
          variant="quiet"
          size="sm"
          icon
          className="hb-day"
          aria-label="The day after"
          disabled={!onDay.on}
          onClick={() => onDay.step(1)}
          data-hour-day="on"
        >
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </Button>
      )}
      <div
        ref={track}
        className="hb-track"
        role="slider"
        tabIndex={0}
        aria-label="Hour"
        aria-valuemin={FIRST_HOUR}
        aria-valuemax={LAST_HOUR}
        aria-valuenow={irishHour(hours[shown] ?? time)}
        aria-valuetext={words}
        onKeyDown={keys}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture?.(event.pointerId);
          setPlaying(false);
          fromPointer(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture?.(event.pointerId))
            fromPointer(event);
        }}
        data-hour-track
      >
        <span className="hb-rail" aria-hidden="true">
          <span className="hb-fill" style={{ width: `${share * 100}%` }} />
          <span className="hb-thumb" style={{ left: `${share * 100}%` }} />
        </span>
        <span className="hb-marks" aria-hidden="true">
          {MARKS.map((h) => (
            <span
              key={h}
              style={{
                left: `${((h - FIRST_HOUR) / (LAST_HOUR - FIRST_HOUR)) * 100}%`,
              }}
            >
              {String(h).padStart(2, "0")}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
