/**
 * A strip of hours a finger scrubs: the map dock's time (src/MapDock.tsx)
 * and the chart's forecast (src/ScrubBar.tsx) alike. About eight hours stand
 * across a phone, a notch for every hour, every third hour's figure and the
 * day's name where a day begins (src/stripHours.ts); a playhead stands still
 * in the middle and the hours slide under it. The time is the hour under the
 * playhead.
 *
 * The strip is the browser's own scroll: a finger drags it one to one and
 * flings it on with the platform's own momentum, and it comes to rest on an
 * hour the forecast has (`stops`, CSS scroll snapping). The motion never
 * waits on the page: the scroll is read on each of its frames, the words over
 * the playhead are written there and then without a render (`readout`), and
 * the page is told the hour (`onPick`) only as the playhead crosses into
 * another, for it to draw that hour's map when it can. A mouse drags it as a
 * finger does, a wheel turns it, a click or a tap on an hour glides there,
 * and as a slider (`slider`) the arrows step an hour, Page Up and Page Down a
 * day, and Home and End go to the ends.
 *
 * Under the notches a drawing of the caller's (`draw`) scrolls with them:
 * the chart's curve of the wind, its stars, waves and tide. It is drawn once
 * for the whole forecast, not once a frame.
 */
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { unfolded, type Fold } from "../shared/web/afterDark";
import { dayAway, hourWidth, nearestIndex, notches } from "./stripHours";

const HOUR = 3600000;
/** The notches' row under the drawing, and the figures' under that. */
const NOTCH_H = 14;
const FIGURE_H = 15;
/** How long after the rider's own scroll another hour is not glided to. */
const SETTLING_MS = 250;
/** How long a flung strip may run on, and snap, after the finger lifts. */
const MOMENTUM_MS = 3000;
/** How long a trackpad's scroll may run on, and snap, after its last wheel event. */
const WHEEL_MS = 800;
/** How long the strip's own picks may still come back from the page as answers. */
const ANSWER_MS = 1500;
/** A mouse that moves less than this between press and release clicked. */
const CLICK_SLOP = 4;

/** Where the hours stand along the strip's content, for a drawing under them. */
export interface StripGeometry {
  /** A time's place along the content, in pixels. */
  x: (time: number) => number;
  /** The content's width: the forecast, and half the strip's either side. */
  width: number;
  /** The strip's own width on the screen. */
  view: number;
  /** One hour's width. */
  hourPx: number;
}

export interface TimeStripProps {
  /** The times the strip comes to rest on, in order: the forecast's columns. */
  stops: readonly number[];
  /** The strip's timeline, where hours are folded out of it (the night hidden). */
  line?: Fold;
  /** Which stop the time is at. */
  at: number;
  now: number;
  /** The playhead has crossed to another stop, or a key, a click or a tap chose one. */
  onPick: (at: number) => void;
  /** The time under the playhead, on every frame the strip moves. */
  onMove?: (time: number) => void;
  /** The words over the playhead for a time, written as the strip moves; none, no words. */
  readout?: (time: number) => string;
  /** What scrolls with the hours, over their notches; the same function until it changes. */
  draw?: (geometry: StripGeometry) => ReactNode;
  /** How tall the drawing is. */
  drawHeight?: number;
  /** The strip is itself the slider the keys and a screen reader use. */
  slider?: { label: string; valueText: (time: number) => string } | null;
  className?: string;
}

function TimeStrip(props: TimeStripProps) {
  const {
    stops,
    line: given,
    at,
    now,
    readout,
    draw,
    drawHeight = 0,
    slider = null,
    className,
  } = props;
  const latest = useRef(props);
  latest.current = props;

  const scroller = useRef<HTMLDivElement>(null);
  const words = useRef<HTMLSpanElement>(null);
  const [view, setView] = useState(0);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const read = () => setView(el.clientWidth);
    read();
    const watch = new ResizeObserver(read);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  /* ---- the geometry: an hour's width, and the forecast laid along it ---- */

  const first = stops[0] ?? now;
  const last = stops[stops.length - 1] ?? first;
  const line = useMemo(
    () => given ?? unfolded(first, last),
    [given, first, last],
  );
  const a0 = line.at(first);
  const hourPx = hourWidth(view);
  const pad = view / 2;
  const width = Math.ceil(((line.at(last) - a0) / HOUR) * hourPx + view);
  const geometry = useMemo<StripGeometry>(
    () => ({
      x: (time) => pad + ((line.at(time) - a0) / HOUR) * hourPx,
      width,
      view,
      hourPx,
    }),
    [line, a0, pad, hourPx, width, view],
  );
  /** The scroll that puts a time under the playhead, and the time under it at a scroll. */
  const scrollFor = (time: number) => ((line.at(time) - a0) / HOUR) * hourPx;
  const timeAt = (scroll: number) =>
    line.time(a0 + (Math.max(0, scroll) / hourPx) * HOUR);
  const geo = useRef({ scrollFor, timeAt, stops });
  geo.current = { scrollFor, timeAt, stops };

  /* ---- the strip's motion ---- */

  const motion = useRef({
    /** The stop the strip stands at: the last it told, or was told. */
    at: -1,
    /** Stops it has told the page of that the page may still answer with. */
    asked: new Set<number>(),
    /** When it last told the page of one. */
    askedAt: 0,
    /** A glide of its own under way, to this scroll; null when none. */
    steer: null as number | null,
    /** When the rider last touched, wheeled or dragged it, and how long its scroll may run on after. */
    inputAt: 0,
    inputFor: 0,
    steerTimer: 0,
    /** A finger is down on it. */
    touching: false,
    /** A mouse dragging it: where it went down, the scroll then, and whether it has moved. */
    drag: null as {
      x: number;
      scroll: number;
      id: number;
      moved: boolean;
    } | null,
    /** A click to let pass: the end of a drag. */
    dragged: false,
    /** When the rider last scrolled it. */
    userAt: 0,
    wheelTimer: 0,
    /** The layout the scroll was last set for. */
    laid: null as object | null,
    /** The words over the playhead now. */
    shown: "",
  });

  /** The words over the playhead, written without a render. */
  const say = (time: number) => {
    const el = words.current;
    const text = latest.current.readout?.(time) ?? "";
    if (!el || text === motion.current.shown) return;
    motion.current.shown = text;
    el.textContent = text;
  };
  /** Snapping off while a mouse or a wheel moves the strip pixel by pixel. */
  const free = (on: boolean) =>
    scroller.current?.classList.toggle("is-free", on);
  const reduced = () =>
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Tell the page the strip has come to another stop. */
  const tell = (i: number) => {
    const m = motion.current;
    m.at = i;
    m.asked.add(i);
    m.askedAt = performance.now();
    latest.current.onPick(i);
  };
  /**
   * Glide to a stop: one the strip chose (a key, a click, the rest after a
   * drag), told to the page if it is another; or one the page chose
   * (`told`), told to nobody.
   */
  const glide = (to: number, told = false) => {
    const el = scroller.current;
    const { stops, scrollFor } = geo.current;
    if (!el || !stops.length) return;
    const i = Math.max(0, Math.min(stops.length - 1, to));
    const m = motion.current;
    // The strip's own glide from here: none of it is the rider's scroll.
    m.inputAt = 0;
    if (told) m.at = i;
    else if (i !== m.at) tell(i);
    const target = scrollFor(stops[i]);
    window.clearTimeout(m.steerTimer);
    if (Math.abs(el.scrollLeft - target) <= 1) {
      m.steer = null;
      free(false);
      return;
    }
    m.steer = target;
    // The words and the reading go to the hour at once; the hours glide
    // there under the playhead.
    latest.current.onMove?.(stops[i]);
    say(stops[i]);
    watchSteer();
    el.scrollTo({ left: target, behavior: reduced() ? "auto" : "smooth" });
  };
  /**
   * Should a glide stall short of its stop (the strip resized under it), the
   * rider's own scrolls are not held off for long: a glide is over once its
   * scroll has stood still a moment.
   */
  const watchSteer = () => {
    const m = motion.current;
    window.clearTimeout(m.steerTimer);
    m.steerTimer = window.setTimeout(() => {
      m.steer = null;
      if (!m.drag) free(false);
      const el = scroller.current;
      if (!el) return;
      const time = geo.current.timeAt(el.scrollLeft);
      latest.current.onMove?.(time);
      say(time);
    }, 400);
  };
  /** Come to rest on the stop nearest the playhead. */
  const settle = () => {
    const el = scroller.current;
    if (!el) return;
    const { stops, timeAt } = geo.current;
    glide(nearestIndex(stops, timeAt(el.scrollLeft)));
  };
  const glideRef = useRef({ glide, settle, watchSteer });
  glideRef.current = { glide, settle, watchSteer };

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const m = motion.current;
    const scrolled = () => {
      const { stops, timeAt } = geo.current;
      const s = el.scrollLeft;
      if (m.steer !== null) {
        // A glide of its own: the words already say where it is going.
        if (Math.abs(s - m.steer) > 1) {
          glideRef.current.watchSteer();
          return;
        }
        m.steer = null;
        window.clearTimeout(m.steerTimer);
        if (!m.drag) free(false);
        return;
      }
      const time = timeAt(s);
      latest.current.onMove?.(time);
      say(time);
      // Only the rider's own scroll, and the momentum and the snap after it,
      // chooses an hour; the browser placing the strip anew does not.
      const now = performance.now();
      if (!m.touching && !m.drag && now - m.inputAt > m.inputFor) return;
      m.userAt = now;
      const i = nearestIndex(stops, time);
      if (i >= 0 && i !== m.at) tell(i);
    };
    /** The rider has hold of the strip, and its scroll may run on this long after. */
    const input = (runOn: number) => {
      m.inputAt = performance.now();
      m.inputFor = runOn;
    };
    const touched = () => {
      m.touching = true;
      m.steer = null;
      input(MOMENTUM_MS);
    };
    const untouched = () => {
      m.touching = false;
      input(MOMENTUM_MS);
    };
    // A wheel across the strip (a trackpad's sideways swipe) is the
    // browser's own; up and down, a mouse's wheel, turns it too, pixel by
    // pixel, and it comes to rest on an hour once the wheel stops.
    const wheel = (event: WheelEvent) => {
      m.steer = null;
      input(WHEEL_MS);
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      event.preventDefault();
      const px =
        event.deltaMode === 1
          ? event.deltaY * 16
          : event.deltaMode === 2
            ? event.deltaY * el.clientWidth
            : event.deltaY;
      free(true);
      el.scrollLeft += px;
      window.clearTimeout(m.wheelTimer);
      m.wheelTimer = window.setTimeout(() => glideRef.current.settle(), 160);
    };
    el.addEventListener("scroll", scrolled, { passive: true });
    el.addEventListener("touchstart", touched, { passive: true });
    el.addEventListener("touchend", untouched, { passive: true });
    el.addEventListener("touchcancel", untouched, { passive: true });
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("scroll", scrolled);
      el.removeEventListener("touchstart", touched);
      el.removeEventListener("touchend", untouched);
      el.removeEventListener("touchcancel", untouched);
      el.removeEventListener("wheel", wheel);
      window.clearTimeout(m.wheelTimer);
      window.clearTimeout(m.steerTimer);
    };
  }, []);

  // The time chosen elsewhere (the list's day, a key, a model's hand-over):
  // the strip glides to it. Its own answer to the rider's scrub, arriving a
  // little behind, is not chosen again; nor is anything while the rider's
  // finger is on it, since the page will have the hour the rider leaves.
  // A new size, a new forecast or a new timeline is a new layout.
  const laid = useMemo(() => ({}), [view, line, stops]);
  useLayoutEffect(() => {
    const el = scroller.current;
    const m = motion.current;
    if (!el || !view || !stops.length || at < 0) return;
    const i = Math.min(at, stops.length - 1);
    if (m.laid !== laid) {
      // A new size or a new forecast: placed at once, nothing told.
      m.laid = laid;
      m.at = i;
      m.asked.clear();
      m.steer = null;
      el.scrollLeft = scrollFor(stops[i]);
      say(timeAt(el.scrollLeft));
      latest.current.onMove?.(timeAt(el.scrollLeft));
      return;
    }
    if (i === m.at) {
      m.asked.clear();
      return;
    }
    const now = performance.now();
    if (m.asked.has(i) && now - m.askedAt < ANSWER_MS) return;
    if (m.touching || m.drag || now - m.userAt < SETTLING_MS) return;
    m.asked.clear();
    glide(i, true);
  }, [at, laid]);
  // Today becomes tomorrow at midnight: the words say so.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    motion.current.shown = "";
    say(timeAt(el.scrollLeft));
  }, [now, readout === undefined]);

  /* ---- a mouse, a click and a tap, and the keys ---- */

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const m = motion.current;
    m.steer = null;
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    event.preventDefault();
    m.drag = {
      x: event.clientX,
      scroll: event.currentTarget.scrollLeft,
      id: event.pointerId,
      moved: false,
    };
    m.dragged = false;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser no longer knows: the drag goes on without.
    }
    free(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = motion.current.drag;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < CLICK_SLOP) return;
    drag.moved = true;
    event.currentTarget.scrollLeft = drag.scroll - dx;
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const m = motion.current;
    const drag = m.drag;
    if (!drag || drag.id !== event.pointerId) return;
    m.drag = null;
    m.dragged = drag.moved;
    if (drag.moved || event.type === "pointercancel") settle();
  };
  /** A click or a tap on an hour: the strip glides there. */
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const m = motion.current;
    if (m.dragged) {
      m.dragged = false;
      return;
    }
    const el = event.currentTarget;
    const box = el.getBoundingClientRect();
    const scroll = el.scrollLeft + (event.clientX - box.left - box.width / 2);
    glide(nearestIndex(stops, timeAt(scroll)));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = motion.current.at < 0 ? at : motion.current.at;
    const to =
      event.key === "ArrowLeft" || event.key === "ArrowDown"
        ? from - 1
        : event.key === "ArrowRight" || event.key === "ArrowUp"
          ? from + 1
          : event.key === "PageUp"
            ? dayAway(stops, from, 1)
            : event.key === "PageDown"
              ? dayAway(stops, from, -1)
              : event.key === "Home"
                ? 0
                : event.key === "End"
                  ? stops.length - 1
                  : null;
    if (to === null) return;
    event.preventDefault();
    // The keys belong to the strip here, not to the map behind it.
    event.stopPropagation();
    glide(to);
  };

  /* ---- what it draws ---- */

  const marks = useMemo(
    () => notches(first, last, given),
    [first, last, given],
  );
  const content = useMemo(() => {
    if (!view) return null;
    const { x } = geometry;
    const nowX = now >= first && now <= last ? x(now) : null;
    return (
      <div
        className="ts-content"
        style={{ width, height: drawHeight + NOTCH_H + FIGURE_H }}
      >
        {draw && (
          <div className="ts-draw" style={{ height: drawHeight }}>
            {draw(geometry)}
          </div>
        )}
        <svg
          className="ts-notches"
          width={width}
          height={NOTCH_H}
          style={{ top: drawHeight }}
          aria-hidden="true"
        >
          {marks.map((mark) => {
            const mx = Math.round(x(mark.time)) + 0.5;
            return (
              <line
                key={mark.time}
                className={`ts-notch is-${mark.kind}${mark.time < now - HOUR / 2 ? " is-past" : ""}`}
                x1={mx}
                x2={mx}
                y1={0}
                y2={
                  mark.kind === "day" ? NOTCH_H : mark.kind === "label" ? 10 : 6
                }
              />
            );
          })}
          {nowX !== null && (
            <circle
              className="ts-now"
              data-strip-now
              cx={nowX}
              cy={NOTCH_H - 3}
              r={2}
            />
          )}
        </svg>
        <div
          className="ts-figures"
          style={{ top: drawHeight + NOTCH_H, height: FIGURE_H }}
          aria-hidden="true"
        >
          {marks.map((mark) =>
            mark.text ? (
              <span
                key={mark.time}
                className={`is-${mark.kind}${mark.time < now - HOUR / 2 ? " is-past" : ""}`}
                style={{ left: x(mark.time) }}
                data-strip-figure={mark.kind}
              >
                {mark.text}
              </span>
            ) : null,
          )}
        </div>
        {stops.map((time) => (
          <i key={time} className="ts-stop" style={{ left: x(time) }} />
        ))}
      </div>
    );
  }, [geometry, marks, stops, draw, drawHeight, now, first, last, width, view]);

  const time = stops[Math.max(0, Math.min(stops.length - 1, at))] ?? now;
  return (
    <div
      className={`time-strip${readout ? " has-when" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--ts-hour": `${hourPx}px` } as CSSProperties}
      data-time-strip
      data-hours-across={
        view ? Math.round((view / hourPx) * 10) / 10 : undefined
      }
    >
      <div className="ts-view">
        {readout && (
          <span
            ref={words}
            className="ts-when"
            data-hour-when
            aria-hidden="true"
          />
        )}
        <div
          ref={scroller}
          className="ts-scroll"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onClick={onClick}
          data-hour-track
          {...(slider
            ? {
                role: "slider",
                tabIndex: 0,
                "aria-label": slider.label,
                "aria-orientation": "horizontal" as const,
                "aria-valuemin": 0,
                "aria-valuemax": Math.max(0, stops.length - 1),
                "aria-valuenow": Math.max(0, at),
                "aria-valuetext": slider.valueText(time),
                onKeyDown,
              }
            : {})}
        >
          {content}
        </div>
        <span
          className="ts-head"
          style={{ height: drawHeight + NOTCH_H + 3 }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export default memo(TimeStrip);
