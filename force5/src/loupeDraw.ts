/**
 * The loupe, drawn: one drawing for the chart's (force5/src/WindMap.tsx), a
 * spot's satellite picture's and the finder cards' (shared/web/Loupe.tsx), so
 * the three are the same loupe. Plain SVG elements, drawn over what is there
 * (`redraw`) so a zoom moves the elements already drawn rather than building
 * them again. The geometry is focus.ts's; the look is ./loupe.css's.
 */
import { beaufortPath } from "../../ui/beaufortPath";
import {
  bezelTicks,
  dialDrawing,
  footBox,
  roseDrawing,
  type Line,
  type LoupeRose,
  type RoseScale,
} from "./focus";
import type { Rose } from "./rideWedge";
import "./loupe.css";

export const SVG = "http://www.w3.org/2000/svg";

/**
 * While `redraw` draws over a drawing: for each parent, how many of its
 * elements have been drawn again so far.
 */
let drawn: Map<Element, number> | null = null;

/**
 * An SVG element, its attributes set, added to a parent. In a redraw, the
 * element already in its place is kept when it is of the same kind and
 * class, and only what differs is set.
 */
export function svgEl(
  parent: Element,
  tag: string,
  attrs: Record<string, string | number> = {},
) {
  let el: Element | null = null;
  if (drawn) {
    const i = drawn.get(parent) ?? 0;
    drawn.set(parent, i + 1);
    const old = parent.children[i];
    if (
      old?.localName === tag &&
      old.getAttribute("class") === (attrs.class ?? null)
    ) {
      el = old;
      drawn.set(el, 0);
      for (const name of el.getAttributeNames())
        if (!(name in attrs)) el.removeAttribute(name);
    } else {
      el = document.createElementNS(SVG, tag);
      parent.insertBefore(el, old ?? null);
    }
  } else {
    el = document.createElementNS(SVG, tag);
    parent.appendChild(el);
  }
  for (const [key, value] of Object.entries(attrs)) {
    const v = typeof value === "number" ? value.toFixed(1) : value;
    if (el.getAttribute(key) !== v) el.setAttribute(key, v);
  }
  return el;
}

/** An element's words, set only when they are not already. */
export function write(el: Element, text: string) {
  if (el.textContent !== text) el.textContent = text;
}

/**
 * Draws into `g` over what is drawn there: a frame of a zoom moves the
 * elements already drawn rather than building them again. What the new
 * drawing does not use goes.
 */
export function redraw(g: Element, draw: () => void) {
  drawn = new Map([[g, 0]]);
  try {
    draw();
    for (const [parent, n] of drawn)
      while (parent.children.length > n) parent.lastElementChild!.remove();
  } finally {
    drawn = null;
  }
}

/** A line from focus.ts's geometry, as an SVG line. */
const lineAttrs = (l: Line) => ({ x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2 });

/**
 * The loupe's hatch, under its own id: `id` is the loupe's, so two loupes on
 * one page (a finder's cards) never share, or lose, each other's.
 */
function hatch(g: Element, id: string) {
  const defs = svgEl(g, "defs");
  const p = svgEl(defs, "pattern", {
    id: `${id}-hatch`,
    width: 6,
    height: 6,
    patternUnits: "userSpaceOnUse",
    patternTransform: "rotate(45)",
  });
  svgEl(p, "line", { class: "loupe-hatch", x1: 0, y1: 0, x2: 0, y2: 6 });
}

export interface LoupeDrawing {
  /** Names its hatch and its words' path; unique on the page. */
  id: string;
  /**
   * The rose to draw in the glass, when it is not the hour's own: the faint
   * one under the rider's floor (drawn faintly), or null for none. The hour's
   * own rose, while it is to scale, without it.
   */
  rose?: { rose: Rose | null; faint: boolean };
  /** The small one on the finder's cards: shapes, no words, ticks or N. */
  small?: boolean;
}

/**
 * The one loupe, at the origin, `r` pixels to the inside of its rim: on the
 * chart round the chosen spot (WindMap.tsx), over a spot's satellite picture
 * (shared/web/Loupe.tsx) and on the finder's cards, drawn the same in each.
 * One fine line for its rim with the compass ticked round it outside, N at
 * the top. No handle and no magnifying: what is under it runs straight on
 * through the glass. Its colours are force5/src/loupe.css's: the theme's on
 * the chart, a photo's own on a picture.
 *
 * Inside it, the ride rose for the hour (focus.ts `roseDrawing`): the no-go
 * hatched, the tack out washed, the tack home dashed, the slow water downwind
 * of them faint along the rim, the drift downwind, and the half-way ring with
 * its distance when it is to scale. On the bezel the needle in the wind's
 * colour, and red only where the wind is carrying a rider out (focus.ts
 * `dialDrawing`). The reading in a box at its foot is `drawFoot`'s.
 */
export function drawLoupe(
  g: SVGGElement,
  r: number,
  /** The rose's distances while it is to scale, else null. */
  scale: RoseScale | null,
  loupe: LoupeRose | null,
  { id, rose: given, small = false }: LoupeDrawing,
) {
  hatch(g, id);
  // Held at its smallest, no longer to scale: a compass, with nothing inside.
  const shown = given ? given.rose : scale ? (loupe?.rose ?? null) : null;
  const rose = roseDrawing(shown, r, small ? null : scale);
  const glass = svgEl(g, "g", {
    class: given?.faint ? "map-rose is-faint" : "map-rose",
  });
  if (rose.nogo) {
    const nogo = svgEl(glass, "g", { class: "map-rose-nogo" });
    svgEl(nogo, "path", { class: "map-rose-nogo-fill", d: rose.nogo.fill });
    svgEl(nogo, "path", {
      class: "map-rose-nogo-hatch",
      d: rose.nogo.fill,
      fill: `url(#${id}-hatch)`,
    });
    for (const e of rose.nogo.edges)
      svgEl(nogo, "line", { class: "map-rose-nogo-edge", ...lineAttrs(e) });
  }
  for (const fan of rose.fans) {
    const fg = svgEl(glass, "g", { class: `map-rose-fan is-${fan.kind}` });
    if (fan.fill)
      svgEl(fg, "path", { class: "map-rose-fan-fill", d: fan.fill });
    for (const e of fan.edges)
      svgEl(fg, "line", { class: "map-rose-fan-edge", ...lineAttrs(e) });
    svgEl(fg, "path", { class: "map-rose-fan-arc", d: fan.arc });
    if (fan.head) svgEl(fg, "path", { class: "map-rose-head", d: fan.head });
  }
  if (rose.slow) svgEl(glass, "path", { class: "map-rose-slow", d: rose.slow });
  for (const ring of rose.rings)
    svgEl(glass, "circle", { class: "map-rose-ring", r: ring.r });
  if (rose.drift) {
    const dg = svgEl(glass, "g", {
      class: `map-rose-drift${rose.drift.out ? " is-out" : ""}`,
    });
    svgEl(dg, "line", {
      class: "map-rose-drift-halo",
      ...lineAttrs(rose.drift.line),
    });
    svgEl(dg, "line", {
      class: "map-rose-drift-line",
      ...lineAttrs(rose.drift.line),
    });
    svgEl(dg, "path", { class: "map-rose-drift-head", d: rose.drift.head });
  }
  if (!small)
    for (const l of [
      ...rose.rings.flatMap((ring) => (ring.label ? [ring.label] : [])),
      ...rose.labels,
    ])
      write(
        svgEl(glass, "text", {
          class: `map-rose-label is-${l.kind}`,
          x: l.x,
          y: l.y,
          "text-anchor": "middle",
        }),
        l.text,
      );

  const rim = svgEl(g, "g", { class: "map-loupe-rim" });
  svgEl(rim, "circle", { class: "map-loupe-edge", r, "data-loupe-rim": "" });
  const facing = loupe?.facing ?? null;
  const dial = loupe ? dialDrawing(loupe.rose.windFrom, facing, r) : null;
  for (const d of dial?.crossOff ?? [])
    svgEl(g, "path", { class: "map-dial-crossoff", d });
  if (!small)
    for (const t of bezelTicks(r))
      svgEl(g, "line", {
        class: t.long ? "map-loupe-tick is-long" : "map-loupe-tick",
        x1: t.x1,
        y1: t.y1,
        x2: t.x2,
        y2: t.y2,
      });
  if (!small)
    write(
      svgEl(g, "text", {
        class: "map-loupe-north",
        y: -r - 2.5,
        "text-anchor": "middle",
      }),
      "N",
    );
  if (!loupe || !dial) return;
  if (dial.offshore) {
    svgEl(g, "path", { class: "map-dial-offshore-arc", d: dial.offshore.arc });
    if (!small) {
      svgEl(g, "path", {
        id: `${id}-offshore-words`,
        class: "map-dial-words-path",
        d: dial.offshore.text,
      });
      const words = svgEl(g, "text", { class: "map-dial-words" });
      write(
        svgEl(words, "textPath", {
          href: `#${id}-offshore-words`,
          startOffset: "50%",
          "text-anchor": "middle",
        }),
        "OFFSHORE",
      );
    }
  }
  const needle = svgEl(g, "g", { class: "map-dial-needle" });
  svgEl(needle, "path", {
    d: dial.needle,
    fill: loupe.colour,
  });
  svgEl(needle, "circle", { cx: dial.pin[0], cy: dial.pin[1], r: 1.6 });
}

/**
 * The box at the bezel's foot: the reading, and the wind's relation to the
 * shore. It is drawn round the origin of a sheet of its own and moved there
 * (`place` in the focus effect), so a box held in view as the chart moves
 * under it costs no drawing at all.
 */
export function drawFoot(foot: SVGGElement, loupe: LoupeRose | null) {
  redraw(foot, () => {
    if (!loupe) return;
    const box = footBox(loupe.reading, loupe.relation, 0);
    svgEl(foot, "rect", {
      class: "map-loupe-foot-box",
      x: -box.w / 2,
      y: -box.h / 2,
      width: box.w,
      height: box.h,
    });
    svgEl(foot, "rect", {
      class: "map-loupe-foot-rule",
      x: -box.w / 2 + 2.5,
      y: -box.h / 2 + 2.5,
      width: box.w - 5,
      height: box.h - 5,
    });
    if (loupe.forces)
      drawForces(foot, -box.w / 2 + 9, loupe.from, loupe.forces);
    else
      write(
        svgEl(foot, "text", {
          class: "map-loupe-reading",
          x: -box.w / 2 + 9,
          y: 4.5,
        }),
        loupe.reading,
      );
    write(
      svgEl(foot, "text", {
        class: `map-loupe-relation${loupe.warn ? " is-warn" : ""}`,
        x: box.w / 2 - 8,
        y: 4,
        "text-anchor": "end",
      }),
      loupe.relation,
    );
  });
}

/** The reading's mono advance: IBM Plex Mono at 13px is 0.6em a character. */
const READING_ADVANCE = 7.8;

/**
 * The reading in Force: "SW", the wind's glyph and force, and the gust's
 * small after a "g". The words are one line of text with room left in it
 * (`dx`) where each glyph stands, the glyphs placed by the mono advance.
 */
function drawForces(
  foot: SVGGElement,
  x: number,
  from: string,
  { wind, gust }: { wind: number; gust: number | null },
) {
  const big = beaufortPath(wind, 13);
  const small = gust === null ? null : beaufortPath(gust, 10);
  // A class of its own, so a redraw never reuses the plain reading's text,
  // whose words would stay beside the parts.
  const text = svgEl(foot, "text", {
    class: "map-loupe-reading is-force",
    x,
    y: 4.5,
  });
  write(svgEl(text, "tspan"), `${from} `);
  const bigX = x + (from.length + 1) * READING_ADVANCE;
  write(svgEl(text, "tspan", { dx: big.width + 1 }), String(wind));
  const glyph = (
    d: ReturnType<typeof beaufortPath>,
    at: number,
    top: number,
  ) => {
    const g = svgEl(foot, "g", {
      class: "map-loupe-glyph",
      transform: `translate(${at.toFixed(1)} ${top})`,
    });
    svgEl(g, "path", { d: d.stroke, "stroke-width": d.strokeWidth });
    if (d.fill)
      svgEl(g, "path", {
        class: "is-pennant",
        d: d.fill,
        "stroke-width": d.strokeWidth * 0.6,
      });
  };
  glyph(big, bigX, -8);
  if (small && gust !== null) {
    write(svgEl(text, "tspan"), " g");
    write(svgEl(text, "tspan", { dx: small.width + 1 }), String(gust));
    const smallX =
      bigX + big.width + 1 + (String(wind).length + 2) * READING_ADVANCE;
    glyph(small, smallX, -5);
  }
}
