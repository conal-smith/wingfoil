/**
 * The spots as a chart's lights: a figure in a ring, the selected hour's
 * stars, with a short arrow blowing downwind. Filled in the stars' own pink
 * to purple from one star to five (src/map.css), dashed at none, faint in
 * the dark. A true offshore hour is struck through in the pen; a cross-offshore
 * one keeps its stars and gets a red arrow instead (and is struck for a
 * learner: the caller decides, through `mark`).
 *
 * Behind the open spot's ring, a wedge spans the headings this rider can
 * hold out to sea at the hour's wind (./rideWedge): the longer the wedge,
 * the better powered the rider, and it pulses faster the more stars. The caller gives it to one light
 * only; on all of them at once it buried the chart. The pulse is a transform
 * and an opacity on an HTML box, for the compositor to run.
 *
 * One DOM button per place, made once and written to in place: rebuilding a
 * hundred and more markers per hour scrubbed stalls the camera.
 *
 * They are not MapLibre's markers, and are not moved one by one through a
 * camera move: each frame of a zoom, a marker's projection, its transform,
 * its promise and animation frame, and the browser working out its style
 * again and moving its layer cost the page more than the rest of the chart
 * did. The buttons are placed where the camera rests; through a move they
 * step aside (src/map.css `.is-moving`) and one canvas draws them, from
 * pictures made at rest (./lightsCanvas). The chart has no rotation and no
 * pitch, so a move takes every light by one scale and shift. A light the
 * rider is at (open, pointed at, on the keys) stays a button and is moved.
 *
 * On every map a spot is a pill or a bead, and no spot's name stands on the
 * map. Beside the Spot finder's list (`mode` "cards") a pill is a card the
 * rider can see: each card at least half in the list's view has its pill
 * (`order`, its place among them), always. Where no list stands beside the
 * map, on the phone's map and the full chart (`mode` "best"), the best few
 * spots in view have one (./pillBest.ts): the most stars, then the
 * favourites, then the map's own figure, kept apart and never two alike side
 * by side, chosen again only when the camera rests somewhere new, so a scrub
 * through the hours never moves them. Either way a pill is centred on its
 * spot, and where spots are close each moved the least it must to stand
 * clear, with a notch pointing at its spot (./pillPlace.ts, laid out once the
 * camera rests). It is neutral, dark with light words, and says what the map
 * shows (./pillContent.ts). Every other spot is a bead, a small off-white
 * dot, the same whatever the map shows, with a finger's reach where the
 * nearest bead is the one meant (`lt-bead`, src/map.css). The open spot
 * (`sel`) always has its pill, light.
 *
 * Under the pointer, or the keys, a pill turns light, and so does a bead,
 * which becomes its light pill there (`light`), and the page outlines the
 * spot's card (`onHover`); a card under the pointer lights its pill the same
 * way. No card opens over the map. A pill pressed opens its spot; a bead
 * pressed is the page's to bring its card into view, or open the spot
 * (`onSelect`, told which was pressed).
 *
 * To the keys the lights are one stop (a roving tab stop, as the layers'
 * rail is): Tab comes to one light, the open spot's or the last the keys
 * were on, else the first in view; the arrows go to the nearest light that
 * way (./lightHit `nextLight`), Enter opens it, and Escape leaves for the
 * chart itself. A hundred and more stops had put the dock beyond a hundred
 * and fifty presses of Tab (#222).
 */
import type * as maplibregl from "maplibre-gl";
import {
  nearestLight,
  nextLight,
  pressedLight,
  tappedLight,
  type Way,
} from "./lightHit";
import { drawLights, lookOf, type Drawn, type Look } from "./lightsCanvas";
import { pillHtml, pillKey, type PillParts } from "./pillContent";
import { BEST_PILLS, bestPills, spotsNear } from "./pillBest";
import { placePills, type Box as PillBox, type PillItem } from "./pillPlace";
import type { Wedge } from "./rideWedge";
import { speedShort, type Units } from "./units";
import type { Spot } from "./weather";

export interface LightState {
  /** Solid stars at the hour, or null where it is dark or not rated yet. */
  stars: number | null;
  /** True until the place's ratings have been worked out. */
  pending: boolean;
  dark: boolean;
  /** Where the wind blows from, in degrees, or null with no reading. */
  from: number | null;
  /** The wind, in knots whatever the rider's units: `speedShort` writes it. */
  windKn: number | null;
  /** The gust, in knots, or null: the plain map's pill raises it beside the wind. */
  gustKn?: number | null;
  compass: string | null;
  mark: "struck" | "cross-off" | null;
  /** The headings the rider can hold out to sea, or null. */
  wedge: Wedge | null;
  /**
   * On the plain map, what the spot's pill says (./pillContent.ts), or null
   * for no pill at all: a bead, even lit.
   */
  pill?: PillParts | null;
  /**
   * On the plain map, the place of the spot's card among those the rider can
   * see in the list, or null: a bead. Placed in this order, the first least moved.
   */
  order?: number | null;
  /**
   * The map's own figure for the spot (the wind, the wave height, the sky),
   * for choosing the best few where no list stands beside the map.
   */
  figure?: number | null;
}

/**
 * Which spots have a pill: beside the list, the cards in view (`order`); where
 * no list stands beside the map, the best few in view, at least `gap` pixels
 * apart. `field` is what the pills say, so a new field chooses them again.
 */
export type PillMode =
  { kind: "cards" } | { kind: "best"; gap: number; field: string };

interface Entry {
  spot: Spot;
  el: HTMLButtonElement;
  /** The light's button again, as a card over the map wants it. */
  button: HTMLButtonElement;
  lngLat: [number, number];
  /** Where it stood on the screen as the camera last rested. */
  x: number;
  y: number;
  /**
   * Its pictures for the canvas through a move (./lightsCanvas), by what each
   * was made from: a zoom in and out over the whole chart goes back and
   * forth between two looks, the lights smaller at the national zoom.
   */
  looks: Map<string, Look>;
  /** Counted up whenever its look changes: its state, or its name's place. */
  rev: number;
  arrow: SVGGElement;
  pulse: HTMLElement;
  wedge: SVGPathElement;
  figure: SVGTextElement;
  sub: HTMLElement;
  /** The pill, on the plain map, and what it says. */
  pill: HTMLElement;
  pillSays: string;
  /** Its place among the pills, or null: a bead. */
  order: number | null;
  /** What the best few are chosen by: its stars, a favourite, the figure. */
  stars: number | null;
  favourite: boolean;
  score: number | null;
  /** How far the pill stands off its spot, and its notch's side and place. */
  dx: number;
  dy: number;
  notch: string;
  key: string;
}

/** The classes this module owns on a marker; the marker keeps its own. */
const MANAGED = [
  "pending",
  "dark",
  "s0",
  "s1",
  "s2",
  "s3",
  "s4",
  "s5",
  "off",
  "xoff",
  "sel",
  "active",
  "named",
  "w-over",
];

/** How long a frame of a move may spend making the lights' pictures. */
const BUDGET_MS = 4;

/** A bead's reach, half its 44 px hit area (src/map.css `.lt-bead`). */
const BEAD_REACH = 22;
/** How far in from the map's edge a pill stands. */
const PILL_ROOM = 4;

/** The base map's own names, which a light's name should not print over. */
const PLACE_LAYERS = ["places", "places-near", "water-names"];

/** A bead (src/map.css), not a pill. */
const isBead = (el: HTMLElement) => el.classList.contains("lt-bead");
/** How near a tap two spots stand for it to be either's: a bead's reach. */
const CROWD_REACH = 22;

/** The plain map's pill (written by `update`) and bead (src/map.css). */
const PILL_HTML = `<span class="lt-pill" aria-hidden="true"></span><span class="lt-bead-dot" aria-hidden="true"></span>`;

const LIGHT_SVG = `<svg viewBox="-30 -30 60 60" aria-hidden="true"><g class="lt-wind"><path class="lt-arrow" d="M0 -9.6V-20.5M-3.4 -16.6L0 -21L3.4 -16.6"/></g><circle class="lt-ring" r="7.6"/><line class="lt-strike" x1="-5.6" y1="5.6" x2="5.6" y2="-5.6"/><text class="lt-n" y="3.4" text-anchor="middle"></text></svg>`;

/** The wedge's radius, in the light's 60-unit box: just foiling to fully powered. */
const WEDGE_SHORT = 11;
const WEDGE_LONG = 32;

const point = (bearing: number, r: number) => {
  const a = (bearing * Math.PI) / 180;
  return `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;
};

/** A sector from the ring's centre, clockwise from `from` to `to`. */
export function wedgePath({ from, to, power }: Wedge): string {
  const r = WEDGE_SHORT + (WEDGE_LONG - WEDGE_SHORT) * power;
  return `M0 0L${point(from, r)}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${point(to, r)}Z`;
}

export interface Lights {
  update(
    states: ReadonlyMap<string, LightState>,
    selected: string | null,
    named: ReadonlySet<string>,
    label: (spot: Spot, state: LightState | undefined) => string,
    units: Units,
  ): void;
  element(id: string): HTMLButtonElement | undefined;
  /**
   * A light pressed, drawn as the open one at once: the page's own update,
   * the dock and the flight follow once that has been painted (#250).
   */
  choose(id: string): void;
  /**
   * One light lit, as a card for its place is under the pointer beside the
   * chart: drawn in ink and larger, with its name, the others fainter. Null
   * puts it out. A class on the light, so nothing is drawn again but it.
   */
  light(id: string | null): void;
  /**
   * The room the map's dock takes at the map's foot, in pixels: beside the
   * list no pill stands there, as no camera move puts a spot there.
   */
  foot(px: number): void;
  /** Which spots have a pill: the cards in view, or the best few. */
  mode(mode: PillMode): void;
  destroy(): void;
}

export function createLights(
  map: maplibregl.Map,
  spots: readonly Spot[],
  /** A light pressed: its place, and whether it was a bead on the plain map. */
  onSelect: (spot: Spot, bead: boolean) => void,
  /** A mouse comes onto a light (its place), or leaves it (null). */
  onHover?: (spot: Spot | null) => void,
  /**
   * A tap where two spots or more stand within a bead's reach, off any pill:
   * the spots there, the nearest first, for the page to offer by name.
   * Without it, the nearest is chosen.
   */
  onCrowd?: (spots: Spot[]) => void,
): Lights {
  const entries = new Map<string, Entry>();
  let laid = "";
  let dirty = true;
  let pillMode: PillMode = { kind: "cards" };
  /** The map's own controls and the rider's mark, which no pill stands on. */
  const walls = (frame: DOMRect): PillBox[] =>
    [
      ...map.getContainer().querySelectorAll(".maplibregl-ctrl, .map-you"),
      ...document.querySelectorAll("[data-map-wall]"),
    ]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width && r.height)
      .map((r) => ({
        l: r.left - frame.left,
        t: r.top - frame.top,
        r: r.right - frame.left,
        b: r.bottom - frame.top,
      }));
  /**
   * The map's own names on the screen, as near as their points and lengths
   * say: centred on their points (src/chartStyle.ts), a little wider than the
   * words for their halo.
   */
  const names = (): PillBox[] => {
    const layers = PLACE_LAYERS.filter((id) => map.getLayer(id));
    if (!layers.length) return [];
    const out: PillBox[] = [];
    for (const f of map.queryRenderedFeatures({ layers })) {
      if (f.geometry.type !== "Point") continue;
      const words = String(
        f.properties?.["name:en"] ?? f.properties?.name ?? "",
      );
      // The largest the names are set at: a city's.
      const size = 13;
      const at = map.project(f.geometry.coordinates as [number, number]);
      const half = words.length * size * 0.3 + 3;
      out.push({
        l: at.x - half,
        t: at.y - size * 0.7,
        r: at.x + half,
        b: at.y + size * 0.7,
      });
    }
    return out;
  };
  /**
   * Where no list stands beside the map: the best few spots in view
   * (./pillBest.ts), the open spot always among them. Chosen again only when
   * the camera rests somewhere new, the field changes, the open spot does, or
   * the stars first come in: never through a scrub of the hours.
   */
  let best: { key: string; ids: string[] } = { key: "", ids: [] };
  const bestInView = (camera: string, frame: DOMRect): Entry[] => {
    if (pillMode.kind !== "best") return [];
    const open = [...entries.values()].find((e) =>
      e.el.classList.contains("sel"),
    );
    const rated = [...entries.values()].some((e) => e.stars !== null);
    const key = `${camera}|${boxW}x${boxH}|${footRoom}|${pillMode.gap}|${pillMode.field}|${open?.spot.id ?? ""}|${rated}`;
    if (key !== best.key) {
      const room = {
        l: PILL_ROOM,
        t: PILL_ROOM,
        r: boxW - PILL_ROOM,
        b: boxH - footRoom - PILL_ROOM,
      };
      best = {
        key,
        ids: bestPills(
          [...entries.values()]
            .filter((e) => e.x >= 0 && e.x <= boxW && e.y >= 0 && e.y <= boxH)
            .map((e) => ({
              id: e.spot.id,
              x: e.x,
              y: e.y,
              w: e.pill.offsetWidth,
              h: e.pill.offsetHeight,
              stars: e.stars,
              favourite: e.favourite,
              figure: e.score,
              says: e.pillSays,
              name: e.spot.name,
            })),
          {
            most: BEST_PILLS,
            gap: pillMode.gap,
            room,
            walls: walls(frame),
            keep: open?.spot.id ?? null,
          },
        ),
      };
    }
    return best.ids.flatMap((id) => entries.get(id) ?? []);
  };
  /**
   * Each spot that has one a pill, placed clear of the others
   * (./pillPlace.ts) where the camera rests, and every other spot a bead:
   * beside the list, the cards in view, in the list's order; elsewhere, the
   * best few. A bead or a station's reading a pill stands on gives it the
   * place.
   */
  const placeAllPills = (camera: string) => {
    const box = map.getContainer();
    const frame = box.getBoundingClientRect();
    const items: PillItem[] = [];
    const wanted =
      pillMode.kind === "best"
        ? bestInView(camera, frame).filter((e) => e.pillSays)
        : [...entries.values()]
            .filter((e) => e.order !== null && e.pillSays)
            .sort((a, b) => a.order! - b.order!);
    for (const e of wanted)
      items.push({
        id: e.spot.id,
        x: e.x,
        y: e.y,
        // Its own size, as laid out even while hidden: transforms aside.
        w: e.pill.offsetWidth,
        h: e.pill.offsetHeight,
        seaward: e.spot.facing ?? null,
      });
    const room = {
      l: PILL_ROOM,
      t: PILL_ROOM,
      r: boxW - PILL_ROOM,
      b: boxH - footRoom - PILL_ROOM,
    };
    const placed = new Map(
      placePills(items, room, walls(frame), names()).map((p) => [p.id, p]),
    );
    const boxes = [...placed.values()].map((p) => p.box);
    for (const entry of entries.values()) {
      const p = placed.get(entry.spot.id);
      const dx = p ? Math.round((p.box.l + p.box.r) / 2 - p.x) : 0;
      const dy = p ? Math.round((p.box.t + p.box.b) / 2 - p.y) : 0;
      const notch = p?.notch
        ? `${p.notch.side}|${Math.round(p.notch.along)}`
        : "";
      // A bead a pill stands on is under it, and out of reach.
      const under =
        !p &&
        boxes.some(
          (b) =>
            entry.x > b.l - 3 &&
            entry.x < b.r + 3 &&
            entry.y > b.t - 3 &&
            entry.y < b.b + 3,
        );
      const { el, pill } = entry;
      const was = `${el.className}|${entry.dx}|${entry.dy}|${entry.notch}`;
      el.classList.toggle("lt-pilled", !!p);
      el.classList.toggle("lt-bead", !p);
      el.classList.toggle("lt-under", under);
      if (dx !== entry.dx || dy !== entry.dy) {
        entry.dx = dx;
        entry.dy = dy;
        // Its button is the pill: moved off the spot with it.
        moveTo(el, entry.x + dx, entry.y + dy);
      }
      if (notch !== entry.notch) {
        entry.notch = notch;
        if (p?.notch) {
          pill.dataset.n = p.notch.side;
          pill.style.setProperty("--n", `${Math.round(p.notch.along)}px`);
        } else delete pill.dataset.n;
      }
      if (`${el.className}|${entry.dx}|${entry.dy}|${entry.notch}` !== was)
        entry.rev++;
    }
    pillBoxes = boxes;
  };
  /** Where the pills beside the list stand, as last placed. */
  let pillBoxes: PillBox[] = [];
  /** The dock's room at the map's foot (`foot`). */
  let footRoom = 0;
  /**
   * The Live wind layer's readings beside the list (./readingPills.ts): a
   * pill has the place, and so do the map's names and a reading kept before
   * it, so nothing stands on anything; one the map's edge or the dock would
   * cut is not shown. Read again whenever the map rests, as the readings
   * come and go of their own accord.
   */
  const thinReadings = () => {
    const box = map.getContainer();
    const frame = box.getBoundingClientRect();
    // On the full chart a reading gives way to a pill only.
    const beside = pillMode.kind === "cards";
    const taken = beside ? [...pillBoxes, ...names()] : [...pillBoxes];
    for (const reading of box.querySelectorAll<HTMLElement>(".obs-mark")) {
      const r = reading.getBoundingClientRect();
      const at = {
        l: r.left - frame.left,
        t: r.top - frame.top,
        r: r.right - frame.left,
        b: r.bottom - frame.top,
      };
      // Cut by the map's edge or in the dock's room: not shown at all.
      const out =
        beside &&
        (at.l < 0 || at.t < 0 || at.r > boxW || at.b > boxH - footRoom);
      const under =
        out ||
        taken.some(
          (b) =>
            at.l < b.r + 2 &&
            b.l < at.r + 2 &&
            at.t < b.b + 2 &&
            b.t < at.b + 2,
        );
      reading.classList.toggle("obs-under", under);
      if (!under) taken.push(at);
    }
  };
  /** The pills where the camera rests. */
  const layout = () => {
    const camera = `${map.getZoom().toFixed(3)}|${map.getCenter().toArray().join(",")}`;
    if (!dirty && camera === laid) {
      thinReadings();
      return;
    }
    laid = camera;
    dirty = false;
    placeAllPills(camera);
    thinReadings();
  };
  let queued = 0;
  const queue = () => {
    if (!queued)
      queued = requestAnimationFrame(() => {
        queued = 0;
        // Laid out where the buttons stand, once the camera rests: through a
        // move they stand where it last did.
        if (moving) return;
        layout();
      });
  };
  map.on("moveend", queue);
  map.on("idle", queue);
  // The chart's own classes decide which names show at all (zoom, focus,
  // the names layer): a change there is a change of what to lay out.
  const classes = new MutationObserver(() => {
    dirty = true;
    queue();
    // Across a zoom's own steps (the lights smaller further out, the names
    // shown closer in) the canvas changes with the buttons.
    if (moving) {
      refresh();
      follow();
    }
  });
  classes.observe(map.getContainer(), {
    attributes: true,
    attributeFilter: ["class"],
  });
  const byId = new Map(spots.map((spot) => [spot.id, spot]));
  /**
   * The spot a click on `el` meant: from a pointer, the nearest light within
   * a button's reach of it (./lightHit), since the reaches of close lights
   * overlap; from a key, the light's own. A press on a pill is never a dot's,
   * however near one stands to the pill's end, nor one on a dot a pill's (a
   * pill stands over a dot, so a press that reached one missed the pills).
   */
  const meant = (spot: Spot, el: HTMLElement, event: MouseEvent): Spot => {
    if (!event.detail) return spot;
    // Pills never overlap: the one under the pointer is the one meant.
    if (el.classList.contains("lt-pilled")) return spot;
    const reach =
      parseFloat(getComputedStyle(el, "::before").width) / 2 || BEAD_REACH;
    const centres = [...entries].map(([id, entry]) => {
      const r = entry.el.getBoundingClientRect();
      return {
        id,
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        dot: isBead(entry.el),
      };
    });
    const id = pressedLight(
      centres,
      event.clientX,
      event.clientY,
      reach,
      isBead(el),
    );
    return (id && byId.get(id)) || spot;
  };
  // The lights' common parent: no box of its own (display: contents), so each
  // light stacks in the map as a marker did. The canvas the lights are drawn
  // on through a move goes under it, so a light kept a button stays on top.
  const layer = document.createElement("div");
  layer.className = "map-lights";
  layer.setAttribute("role", "group");
  layer.setAttribute("aria-label", "Spots on the chart");
  const canvas = document.createElement("canvas");
  canvas.className = "lights-canvas";
  canvas.setAttribute("aria-hidden", "true");
  map.getCanvasContainer().append(canvas, layer);
  /** Where the screen's top left corner was when the lights were last placed. */
  let origin: maplibregl.LngLat | null = null;
  let restZoom = 0;
  const moveTo = (el: HTMLElement, x: number, y: number) => {
    el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
  };
  /** The lights kept as buttons through a move, and the rest, as drawn. */
  let live: Entry[] = [];
  /** The lights still waiting for their pictures, buttons until they have them. */
  const waiting = new Set<Entry>();
  let drawn: Drawn[] = [];
  let moving = false;
  /** Whether some light still waits for its picture, out of the last frame's time. */
  let behind = false;
  const dpr = () => window.devicePixelRatio || 1;
  /** A light the rider is at: pointed at, open, on the keys, or pulsing. */
  const isLive = ({ el, pulse }: Entry) =>
    el.classList.contains("sel") ||
    el.classList.contains("lit") ||
    el.classList.contains("gust-highlight") ||
    el.classList.contains("is-open") ||
    el === document.activeElement ||
    el.matches(":hover") ||
    pulse.style.display !== "none";
  /**
   * Each light's picture, made again where what it is drawn from changed:
   * its classes and state, the chart's (zoom, focus, names) and the pixel
   * ratio. A name is drawn only for a light within a screen of the view:
   * further off, at a close zoom, every name in the country would be a
   * picture held.
   */
  const capture = (budget: number) => {
    const w = boxW;
    const h = boxH;
    const chart = `${map.getContainer().className}|${dpr()}`;
    const out = new Map<Entry, Look>();
    const until = performance.now() + budget;
    behind = false;
    for (const entry of entries.values()) {
      if (live.includes(entry)) continue;
      const near =
        entry.x > -w && entry.x < 2 * w && entry.y > -h && entry.y < 2 * h;
      const sig = `${chart}|${entry.rev}|${near}`;
      let look = entry.looks.get(sig);
      if (!look && performance.now() > until) {
        // Out of time in this frame: it stays a button until the next.
        behind = true;
        continue;
      }
      if (!look) {
        const r = entry.el.getBoundingClientRect();
        look = lookOf(
          entry.el,
          { x: r.left + r.width / 2, y: r.top + r.height / 2 },
          dpr(),
          near,
        );
        // The last few only: the pictures of a look long gone are let go.
        if (entry.looks.size >= 3)
          entry.looks.delete(entry.looks.keys().next().value!);
        entry.looks.set(sig, look);
      }
      out.set(entry, look);
    }
    return out;
  };
  /**
   * What the canvas draws, in the order the buttons stack: the dots under
   * everything, the named on top.
   * Through a move, a few milliseconds of new pictures a frame: a zoom in to
   * where every light's name shows makes a picture of each.
   */
  const refresh = () => {
    const looks = capture(BUDGET_MS);
    // A light with no picture yet stays a button, moved, until it has one.
    for (const entry of entries.values()) {
      if (live.includes(entry)) continue;
      const wait = !looks.has(entry);
      if (wait === waiting.has(entry)) continue;
      if (wait) waiting.add(entry);
      else waiting.delete(entry);
      entry.el.classList.toggle("lt-live", wait);
    }
    const named = (e: Entry) => e.el.classList.contains("named");
    // A bead a pill stands on is not drawn: the pill has the place.
    const all = [...looks.keys()].filter(
      (e) => !e.el.classList.contains("lt-under"),
    );
    const marks = all.filter((e) => !isBead(e.el));
    drawn = [
      ...all.filter((e) => isBead(e.el)),
      ...marks.filter((e) => !named(e)),
      ...marks.filter(named),
    ].map((e) => ({ x: e.x, y: e.y, dx: e.dx, dy: e.dy, look: looks.get(e)! }));
  };
  /** Each light at its place on the screen, with the camera at rest. */
  const place = () => {
    for (const entry of entries.values()) {
      const p = map.project(entry.lngLat);
      entry.x = Math.round(p.x);
      entry.y = Math.round(p.y);
      moveTo(entry.el, entry.x + entry.dx, entry.y + entry.dy);
    }
    origin = map.unproject([0, 0]);
    restZoom = map.getZoom();
    rove();
  };
  /** Whether a light stands on the screen, as the camera last rested. */
  const inView = ({ x, y }: Entry) =>
    x >= 0 && x <= boxW && y >= 0 && y <= boxH;
  /**
   * The one light Tab stops on: the one the keys are on, else the open
   * spot's, else the last the keys were on, while each is in view; else the
   * first in view, else the first; a dot only with no other mark in view.
   */
  let stop: Entry | undefined;
  const rove = (to?: Entry) => {
    const all = [...entries.values()];
    const next =
      to ??
      all.find((entry) => entry.el === document.activeElement) ??
      [all.find((entry) => entry.el.classList.contains("sel")), stop].find(
        (entry) => entry && inView(entry) && !isBead(entry.el),
      ) ??
      all.find((entry) => inView(entry) && !isBead(entry.el)) ??
      all.find(inView) ??
      all[0];
    if (next === stop) return;
    if (stop) stop.el.tabIndex = -1;
    stop = next;
    if (stop) stop.el.tabIndex = 0;
  };
  /** The arrows walk the lights in view; Escape leaves them for the chart. */
  const ARROWS: Record<string, Way> = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
  };
  const onKey = (event: KeyboardEvent) => {
    const from = [...entries.values()].find((e) => e.el === event.target);
    if (!from || event.altKey || event.ctrlKey || event.metaKey) return;
    const way = ARROWS[event.key];
    if (!way && event.key !== "Escape") return;
    // Not the chart's own: it pans on the arrows, and the page lets go of
    // the spot on Escape.
    event.preventDefault();
    event.stopPropagation();
    if (!way) {
      map.getCanvas().focus();
      return;
    }
    const shown = [...entries].filter(([, e]) => e === from || inView(e));
    const id = nextLight(
      shown.map(([id, { x, y }]) => ({ id, x, y })),
      { id: from.el.dataset.spotId!, x: from.x, y: from.y },
      way,
    );
    const to = id ? entries.get(id) : undefined;
    if (!to) return;
    rove(to);
    to.el.focus({ preventScroll: true });
  };
  layer.addEventListener("keydown", onKey);
  // Wherever the keys or a click put the focus among them, Tab comes back to.
  const onFocus = (event: FocusEvent) => {
    const at = [...entries.values()].find((e) => e.el === event.target);
    if (at) rove(at);
  };
  layer.addEventListener("focusin", onFocus);
  /**
   * The map's box, read when it is resized: read as a move begins, it laid
   * the page out again then and there.
   */
  let boxW = 0;
  let boxH = 0;
  const measure = () => {
    const box = map.getContainer();
    boxW = box.clientWidth;
    boxH = box.clientHeight;
  };
  /** The canvas over the map's box, in device pixels. */
  const size = () => {
    const w = Math.round(boxW * dpr());
    const h = Math.round(boxH * dpr());
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  };
  const resized = () => {
    measure();
    end();
    // A new box is new room for the pills beside the list.
    dirty = true;
    queue();
  };
  /** A move begins: the lights step aside for their pictures. */
  const begin = () => {
    if (moving) return;
    moving = true;
    live = [...entries.values()].filter(isLive);
    for (const entry of live) entry.el.classList.add("lt-live");
    refresh();
    size();
    layer.classList.add("is-moving");
    follow();
  };
  /** Through a move: the same scale and shift for every light. */
  const follow = () => {
    if (!origin) return;
    if (!moving) begin();
    else if (behind) refresh();
    const at = map.project(origin);
    const k = 2 ** (map.getZoom() - restZoom);
    drawLights(canvas, drawn, k, at.x, at.y, dpr());
    // A pill moved off its spot stays as far off it, whatever the zoom.
    for (const { el, x, y, dx, dy } of [...live, ...waiting])
      moveTo(el, k * x + at.x + dx, k * y + at.y + dy);
  };
  /** At rest: the buttons back, where the camera has them. */
  const end = () => {
    place();
    if (!moving) return;
    moving = false;
    layer.classList.remove("is-moving");
    for (const entry of [...live, ...waiting])
      entry.el.classList.remove("lt-live");
    live = [];
    waiting.clear();
    drawn = [];
    const g = canvas.getContext("2d")!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
  };
  /** A light pressed: its place, and whether it was a bead. */
  const press = (spot: Spot) => {
    const entry = entries.get(spot.id);
    onSelect(spot, !!entry && isBead(entry.el));
  };
  /**
   * The light under the mouse beside the list, or on the keys: its pill lit
   * and its card outlined, by the page (`onHover`). Among beads the nearest
   * to the pointer, their reaches overlapping.
   */
  let hovered: Entry | null = null;
  const hover = (entry: Entry | null) => {
    if (entry === hovered) return;
    hovered = entry;
    onHover?.(entry?.spot ?? null);
  };
  /** The bead nearest a point on the page, within a bead's reach of it. */
  const nearestBead = (x: number, y: number): Entry | null => {
    const frame = map.getContainer().getBoundingClientRect();
    const id = nearestLight(
      [...entries]
        .filter(([, e]) => isBead(e.el) && !e.el.classList.contains("lt-under"))
        .map(([id, e]) => ({ id, x: e.x, y: e.y })),
      x - frame.left,
      y - frame.top,
      BEAD_REACH,
    );
    return id ? (entries.get(id) ?? null) : null;
  };
  for (const spot of spots) {
    const el = document.createElement("button");
    el.type = "button";
    // Before the marker is made: it adds classes of its own to the element.
    el.className = "spot-marker lt pending";
    el.dataset.spotId = spot.id;
    el.tabIndex = -1;
    el.innerHTML = `<span class="lt-pulse" aria-hidden="true"><svg class="lt-wedge" viewBox="-30 -30 60 60"><path/></svg></span>${LIGHT_SVG}${PILL_HTML}<span class="lt-lab" aria-hidden="true"><b></b><i></i></span>`;
    el.querySelector(".lt-lab b")!.textContent = spot.name;
    const entry: Entry = {
      spot,
      el,
      button: el,
      lngLat: [spot.lon, spot.lat],
      x: 0,
      y: 0,
      looks: new Map(),
      rev: 0,
      arrow: el.querySelector<SVGGElement>(".lt-wind")!,
      pulse: el.querySelector<HTMLElement>(".lt-pulse")!,
      wedge: el.querySelector<SVGPathElement>(".lt-wedge path")!,
      figure: el.querySelector<SVGTextElement>(".lt-n")!,
      sub: el.querySelector<HTMLElement>(".lt-lab i")!,
      pill: el.querySelector<HTMLElement>(".lt-pill")!,
      pillSays: "",
      order: null,
      stars: null,
      favourite: false,
      score: null,
      dx: 0,
      dy: 0,
      notch: "",
      key: "",
    };
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      // Where no list stands beside the map, a finger's tap off any pill with
      // two spots or more within a bead's reach is the page's to ask which. A
      // mouse is precise enough to mean the one it is on.
      const finger =
        (event as PointerEvent).pointerType === "touch" ||
        window.matchMedia("(pointer: coarse)").matches;
      if (
        onCrowd &&
        event.detail &&
        finger &&
        pillMode.kind === "best" &&
        !el.classList.contains("lt-pilled")
      ) {
        const frame = map.getContainer().getBoundingClientRect();
        const near = spotsNear(
          [...entries.values()]
            .filter((e) => !e.el.classList.contains("lt-under"))
            .map((e) => ({ id: e.spot.id, x: e.x, y: e.y })),
          event.clientX - frame.left,
          event.clientY - frame.top,
          CROWD_REACH,
        );
        if (near.length >= 2)
          return onCrowd(near.flatMap((id) => byId.get(id) ?? []));
      }
      press(meant(spot, el, event));
    });
    // A pill is the one under the pointer; over a bead's reach, the nearest
    // bead, until its light pill is under the pointer.
    el.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      const onPill = (event.target as Element).closest?.(".lt-pill");
      hover(
        isBead(el) && !onPill
          ? (nearestBead(event.clientX, event.clientY) ?? entry)
          : entry,
      );
    });
    el.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "mouse") return;
      // Onto another light: its own move takes the hover.
      const next = (event.relatedTarget as Element | null)?.closest?.(".lt");
      if (next && layer.contains(next)) return;
      hover(null);
    });
    el.addEventListener("focus", () => hover(entry));
    el.addEventListener("blur", () => {
      if (hovered === entry) hover(null);
    });
    // As MapLibre's markers do: a press on a light neither drags it as an
    // image nor moves the focus.
    el.addEventListener("dragstart", (event) => event.preventDefault());
    el.addEventListener("mousedown", (event) => event.preventDefault());
    layer.appendChild(el);
    entries.set(spot.id, entry);
  }
  // Through a move the buttons are out of reach (src/map.css): a tap on a
  // light as it is drawn chooses it all the same, the nearest within a
  // button's reach (./lightHit), and goes no further, to the chart's own pick.
  const box = map.getContainer();
  const tapped = (event: MouseEvent) => {
    if (!moving || !origin || !box.contains(event.target as Node)) return;
    const frame = box.getBoundingClientRect();
    const at = map.project(origin);
    const k = 2 ** (map.getZoom() - restZoom);
    // A pill as drawn: off its spot by as much as it was placed.
    const centres = [...entries].map(([id, { el, x, y, dx, dy }]) => ({
      id,
      x: frame.left + k * x + at.x + dx,
      y: frame.top + k * y + at.y + dy,
      dot: isBead(el),
    }));
    // A button's reach (src/map.css .lt::before): 44 px across under a
    // finger, 32 under a mouse.
    const reach = window.matchMedia("(pointer: coarse)").matches ? 22 : 16;
    const id = tappedLight(
      centres,
      event.clientX,
      event.clientY,
      reach,
      BEAD_REACH / 2,
    );
    const spot = id ? byId.get(id) : undefined;
    if (!spot) return;
    event.stopPropagation();
    press(spot);
  };
  window.addEventListener("click", tapped, true);
  measure();
  place();
  map.on("movestart", begin);
  map.on("move", follow);
  map.on("moveend", end);
  map.on("resize", resized);
  return {
    update(states, selected, named, label, units) {
      for (const spot of spots) {
        const entry = entries.get(spot.id);
        if (!entry) continue;
        const s = states.get(spot.id);
        // What the best few are chosen by, whether or not the look changed.
        entry.stars =
          s && !s.pending && !s.dark && s.stars !== null ? s.stars : null;
        entry.favourite = named.has(spot.id);
        entry.score = s?.figure ?? null;
        const on = spot.id === selected;
        const w = s?.wedge;
        const key = s
          ? `${s.pending}|${s.stars}|${s.dark}|${s.mark}|${s.from === null ? "" : Math.round(s.from)}|${s.windKn === null ? "" : speedShort(s.windKn, units)}|${w ? `${Math.round(w.from)},${Math.round(w.to)},${Math.round(w.power * 20)},${w.state}` : ""}|${on}|${named.has(spot.id)}|${s.order ?? ""}|${pillKey(s.pill ?? null)}`
          : `none|${on}|${named.has(spot.id)}`;
        if (entry.key === key) continue;
        entry.key = key;
        entry.rev++;
        const { el } = entry;
        const level =
          !s || s.pending
            ? "pending"
            : s.dark || s.stars === null
              ? "dark"
              : `s${s.stars}`;
        const want = new Set([
          level,
          ...(s?.mark === "struck" ? ["off"] : []),
          ...(s?.mark === "cross-off" ? ["xoff"] : []),
          ...(w?.state === "over" ? ["w-over"] : []),
          ...(on ? ["sel", "active"] : []),
          ...(named.has(spot.id) ? ["named"] : []),
        ]);
        for (const name of MANAGED) el.classList.toggle(name, want.has(name));
        entry.figure.textContent =
          s && !s.pending && !s.dark && s.stars !== null ? String(s.stars) : "";
        if (s && s.from !== null) {
          entry.arrow.setAttribute(
            "transform",
            `rotate(${Math.round(s.from + 180)})`,
          );
          entry.arrow.style.display = "";
        } else entry.arrow.style.display = "none";
        // The plain map's pill: what it says, and its place among the pills.
        const says = pillKey(s?.pill ?? null);
        if (says !== entry.pillSays) {
          entry.pillSays = says;
          entry.pill.innerHTML = pillHtml(s?.pill ?? null);
        }
        entry.order = s?.order ?? null;
        if (w && level.startsWith("s")) {
          entry.wedge.setAttribute("d", wedgePath(w));
          entry.pulse.style.display = "";
        } else entry.pulse.style.display = "none";
        entry.sub.textContent =
          s && !s.pending && s.compass !== null && s.windKn !== null
            ? // The wind and the shore, not the stars: the ring's figure
              // says those, and "0★" under a dashed "0" read as a glitch.
              `${s.compass} ${speedShort(s.windKn, units)}${s.mark ? ` · ${s.mark === "struck" ? "offshore" : "cross-off"}` : ""}`
            : "";
        dirty = true;
      }
      // Every time, not only when the light changes: the name also says the
      // hour and the units, which a light's look does not show.
      for (const spot of spots) {
        const el = entries.get(spot.id)?.el;
        const name = label(spot, states.get(spot.id));
        if (el && el.getAttribute("aria-label") !== name)
          el.setAttribute("aria-label", name);
      }
      if (dirty) queue();
      rove();
    },
    element: (id) => entries.get(id)?.el,
    choose(id) {
      const chosen = entries.get(id);
      if (!chosen) return;
      for (const entry of [...entries.values()].filter(
        (e) => e === chosen || e.el.classList.contains("sel"),
      )) {
        const on = entry === chosen;
        entry.el.classList.toggle("sel", on);
        entry.el.classList.toggle("active", on);
        // Written again in full by the next update, whatever it says.
        entry.key = "";
        entry.rev++;
      }
      dirty = true;
      queue();
    },
    light(id) {
      // Its look through a move changes with it (./lightsCanvas); its name
      // shows whatever the layout of the names, from the stylesheet.
      for (const [key, entry] of entries) {
        const on = key === id;
        if (entry.el.classList.contains("lit") === on) continue;
        entry.el.classList.toggle("lit", on);
        entry.rev++;
      }
      layer.classList.toggle("has-lit", id !== null && entries.has(id));
    },
    foot(px) {
      if (px === footRoom) return;
      footRoom = px;
      dirty = true;
      queue();
    },
    mode(next) {
      if (JSON.stringify(next) === JSON.stringify(pillMode)) return;
      pillMode = next;
      dirty = true;
      queue();
    },
    destroy() {
      cancelAnimationFrame(queued);
      classes.disconnect();
      map.off("moveend", queue);
      map.off("idle", queue);
      map.off("movestart", begin);
      map.off("move", follow);
      map.off("moveend", end);
      map.off("resize", resized);
      window.removeEventListener("click", tapped, true);
      layer.removeEventListener("keydown", onKey);
      layer.removeEventListener("focusin", onFocus);
      layer.remove();
      canvas.remove();
      entries.clear();
    },
  };
}
