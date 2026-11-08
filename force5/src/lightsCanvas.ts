/**
 * The lights through a camera move, drawn on one canvas (./lights.ts).
 *
 * At rest every light is its own button, styled by src/map.css. Moved one by
 * one through a zoom, those buttons cost the page more than the rest of the
 * chart together: each frame the browser worked out every light's style
 * again and moved its layer. So for the length of a move the buttons step
 * aside and this canvas draws them instead, from pictures of each made from
 * the buttons' own computed styles as a move begins (and kept for the next):
 * the ring with its figure and
 * strike, the wind's arrow (turned as it is drawn), and the name with its
 * halo. A frame is then one picture or three per light, placed. A light the
 * rider is pointing at, has open or has the keys on stays a button.
 *
 * On the plain map a light is a pill or a bead (./lights.ts): a pill's
 * picture is its box, its notch, its arrow, its sky and its figures, a bead's
 * its dot and halo, from their own computed styles, in place of the ring and
 * the arrow beside it. A pill moved off its spot is drawn off it as much.
 *
 * The pictures are drawn to the device's pixels, on the same pixel grid as
 * the buttons at rest, so where the camera starts and ends they are the
 * buttons' pixels.
 */
import { PILL_ARROW } from "./pillContent";

/** A picture, and where it stands from the light's centre, in CSS pixels. */
interface Sprite {
  /** A bitmap, not a canvas: drawn from, a small canvas is sent to the GPU again each time. */
  canvas: ImageBitmap;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One light as the canvas draws it. */
export interface Look {
  ring: Sprite;
  arrow: Sprite | null;
  label: Sprite | null;
}

/** The wind's arrow (lights.ts LIGHT_SVG), in the light's own units. */
const ARROW = "M0 -9.6V-20.5M-3.4 -16.6L0 -21L3.4 -16.6";
const ARROW_POINTS = [
  [0, -9.6],
  [0, -20.5],
  [-3.4, -16.6],
  [0, -21],
  [3.4, -16.6],
];
const RING_R = 7.6;
const STRIKE = 5.6;
/** The figure's baseline, in the light's own units (lights.ts LIGHT_SVG). */
const FIGURE_Y = 3.4;

const px = (v: string) => parseFloat(v) || 0;

/**
 * A picture `w` by `h` CSS pixels, its origin `ox`, `oy` in from its top left
 * corner, on whole device pixels; `paint` draws round the origin.
 */
function sprite(
  w: number,
  h: number,
  ox: number,
  oy: number,
  dpr: number,
  paint: (g: OffscreenCanvasRenderingContext2D) => void,
): Sprite {
  const dx = Math.ceil(ox * dpr);
  const dy = Math.ceil(oy * dpr);
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.ceil(w * dpr) + 1),
    Math.max(1, Math.ceil(h * dpr) + 1),
  );
  const g = canvas.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, dx, dy);
  paint(g);
  return {
    canvas: canvas.transferToImageBitmap(),
    x: -dx / dpr,
    y: -dy / dpr,
    w: canvas.width / dpr,
    h: canvas.height / dpr,
  };
}

/** A stroke as an SVG element's computed style has it. */
function strokeAs(
  g: OffscreenCanvasRenderingContext2D,
  cs: CSSStyleDeclaration,
) {
  g.strokeStyle = cs.stroke;
  g.lineWidth = px(cs.strokeWidth);
  g.lineCap = cs.strokeLinecap as CanvasLineCap;
  g.lineJoin = cs.strokeLinejoin as CanvasLineJoin;
  g.setLineDash(
    cs.strokeDasharray === "none"
      ? []
      : cs.strokeDasharray.split(/[ ,]+/).map(px),
  );
}

const fontOf = (cs: CSSStyleDeclaration) =>
  `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;

/** "rgb(…) 0px 0px 2px, …" as colours and blurs, the first on top. */
export function shadows(value: string) {
  const out: { color: string; blur: number }[] = [];
  if (!value || value === "none") return out;
  const re =
    /((?:[a-z-]+\([^)]*\))|#[0-9a-f]+|[a-z]+)\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+([\d.]+)px)?/gi;
  for (const m of value.matchAll(re))
    out.push({ color: m[1], blur: Number(m[4] ?? 0) });
  return out;
}

/**
 * Text as an HTML box sets it: on its line's baseline, the leading split
 * above and below, with its text-shadows under it.
 */
function text(
  g: OffscreenCanvasRenderingContext2D,
  el: Element,
  box: DOMRect,
  at: { x: number; y: number },
  dpr: number,
) {
  const words = el.textContent ?? "";
  if (!words) return;
  const cs = getComputedStyle(el);
  g.font = fontOf(cs);
  const m = g.measureText(words);
  const a = m.fontBoundingBoxAscent;
  const d = m.fontBoundingBoxDescent;
  const block = cs.display === "block";
  const right = block && cs.textAlign === "right";
  g.textAlign = right ? "right" : "left";
  g.textBaseline = "alphabetic";
  const x = (right ? box.right : box.left) - at.x;
  const y = box.top - at.y + (box.height - (a + d)) / 2 + a;
  // The halo alone: drawn far off the picture, its shadow brought back.
  const away = 100000;
  for (const s of shadows(cs.textShadow).reverse()) {
    g.save();
    g.shadowColor = s.color;
    g.shadowBlur = s.blur * dpr;
    g.shadowOffsetX = away * dpr;
    g.fillStyle = s.color;
    g.fillText(words, x - away, y);
    g.restore();
  }
  g.fillStyle = cs.color;
  g.fillText(words, x, y);
}

const ringCache = new Map<string, Sprite>();
const pillCache = new Map<string, Sprite>();
const beadCache = new Map<string, Sprite>();

/** A filled or stroked SVG shape's paint, as its computed style has it. */
const painted = (paint: string) =>
  !!paint && paint !== "none" && paint !== "transparent";

/** An SVG glyph's paths and circles, as styled, in its own units. */
function drawGlyph(g: OffscreenCanvasRenderingContext2D, svg: SVGElement) {
  for (const part of svg.querySelectorAll<SVGElement>("path, circle")) {
    const cs = getComputedStyle(part);
    const shape = new Path2D();
    if (part.localName === "circle")
      shape.arc(
        Number(part.getAttribute("cx")),
        Number(part.getAttribute("cy")),
        Number(part.getAttribute("r")),
        0,
        2 * Math.PI,
      );
    else shape.addPath(new Path2D(part.getAttribute("d") ?? ""));
    g.save();
    g.globalAlpha = Number(cs.opacity || 1);
    if (painted(cs.fill)) {
      g.fillStyle = cs.fill;
      g.fill(shape);
    }
    if (painted(cs.stroke)) {
      strokeAs(g, cs);
      g.stroke(shape);
    }
    g.restore();
  }
}

/**
 * A pill's notch (src/map.css `.lt-pill[data-n]::after`): a small square
 * turned on its corner, centred on the edge facing the spot, its outer half
 * standing past it with the pill's edge round it.
 */
function drawNotch(
  g: OffscreenCanvasRenderingContext2D,
  side: string,
  along: number,
  box: { x: number; y: number; w: number; h: number },
  fill: string,
  edge: string,
  bw: number,
) {
  const at =
    side === "b"
      ? { x: box.x + along, y: box.y + box.h, turn: 0 }
      : side === "t"
        ? { x: box.x + along, y: box.y, turn: Math.PI }
        : side === "l"
          ? { x: box.x, y: box.y + along, turn: Math.PI / 2 }
          : { x: box.x + box.w, y: box.y + along, turn: -Math.PI / 2 };
  const r = NOTCH / Math.SQRT2;
  g.save();
  g.translate(at.x, at.y);
  g.rotate(at.turn);
  g.beginPath();
  g.moveTo(-r, 0);
  g.lineTo(0, -r);
  g.lineTo(r, 0);
  g.lineTo(0, r);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  if (bw) {
    g.beginPath();
    g.moveTo(-r + bw / 2, bw / 2);
    g.lineTo(0, r - bw / 2);
    g.lineTo(r - bw / 2, bw / 2);
    g.strokeStyle = edge;
    g.lineWidth = bw;
    g.stroke();
  }
  g.restore();
}
/** The notch's side, in CSS pixels (src/map.css). */
const NOTCH = 7;

/** A picture of a light's pill as it is styled now, from the light's centre `at`. */
function pillSprite(
  pill: HTMLElement,
  at: { x: number; y: number },
  dpr: number,
): Sprite {
  const cs = getComputedStyle(pill);
  const box = pill.getBoundingClientRect();
  const svg = pill.querySelector<SVGElement>("svg.lt-pa");
  const turn = svg?.querySelector("g");
  const shown = !!svg && !!turn && getComputedStyle(turn).display !== "none";
  const path = svg?.querySelector("path");
  const pathCs = path ? getComputedStyle(path) : null;
  const sky = pill.querySelector<SVGElement>("svg.lt-sky");
  const parts = [...pill.querySelectorAll<HTMLElement>("b, sup, .lt-u")].filter(
    (p) => p.textContent,
  );
  const notch = pill.dataset.n ?? "";
  const along = notch ? px(pill.style.getPropertyValue("--n")) : 0;
  const key = [
    dpr,
    Math.round(box.width * 4),
    Math.round(box.height * 4),
    cs.backgroundColor,
    cs.borderTopColor,
    cs.borderTopWidth,
    cs.borderTopStyle,
    cs.borderTopLeftRadius,
    cs.transform,
    shown
      ? `${turn!.getAttribute("transform")}|${pathCs!.stroke}|${getComputedStyle(svg!).backgroundColor}`
      : "",
    ...parts.map((p) => `${p.textContent}|${getComputedStyle(p).color}`),
    sky ? `${sky.innerHTML}|${getComputedStyle(sky).color}` : "",
    notch ? `${notch}${along}` : "",
  ].join("|");
  const cached = pillCache.get(key);
  // The same pill elsewhere: placed from this light's centre.
  if (cached) return cached;
  // Room for the notch past the pill's edge.
  const pad = notch ? NOTCH : 2;
  const left = box.left - pad;
  const top = box.top - pad;
  const sprite_ = sprite(
    box.width + 2 * pad,
    box.height + 2 * pad,
    at.x - left,
    at.y - top,
    dpr,
    (g) => {
      const bw = px(cs.borderTopWidth);
      const x = box.left - at.x + bw / 2;
      const y = box.top - at.y + bw / 2;
      const w = box.width - bw;
      const h = box.height - bw;
      const radius = Math.min(px(cs.borderTopLeftRadius), h / 2);
      g.beginPath();
      g.roundRect(x, y, w, h, radius);
      g.fillStyle = cs.backgroundColor;
      g.fill();
      if (bw && cs.borderTopStyle !== "none") {
        g.strokeStyle = cs.borderTopColor;
        g.lineWidth = bw;
        g.setLineDash(cs.borderTopStyle === "dashed" ? [3 * bw, 2 * bw] : []);
        g.stroke();
        g.setLineDash([]);
      }
      if (notch)
        drawNotch(
          g,
          notch,
          along,
          {
            x: box.left - at.x,
            y: box.top - at.y,
            w: box.width,
            h: box.height,
          },
          cs.backgroundColor,
          cs.borderTopColor,
          cs.borderTopStyle === "none" ? 0 : bw,
        );
      if (sky) {
        const r = sky.getBoundingClientRect();
        const k = r.width / 24;
        g.save();
        g.translate(r.left - at.x, r.top - at.y);
        g.scale(k, k);
        drawGlyph(g, sky);
        g.restore();
      }
      if (shown && pathCs) {
        const r = svg!.getBoundingClientRect();
        const k = r.width / 12;
        const deg = Number(
          /rotate\((-?[\d.]+)/.exec(
            turn!.getAttribute("transform") ?? "",
          )?.[1] ?? 0,
        );
        g.save();
        g.translate(r.left - at.x + r.width / 2, r.top - at.y + r.height / 2);
        // The ground's disc an offshore arrow sits on (src/map.css).
        const disc = getComputedStyle(svg!).backgroundColor;
        if (disc && disc !== "transparent" && disc !== "rgba(0, 0, 0, 0)") {
          g.beginPath();
          g.arc(0, 0, r.width / 2 + 1.5, 0, 2 * Math.PI);
          g.fillStyle = disc;
          g.fill();
        }
        g.scale(k, k);
        g.rotate((deg * Math.PI) / 180);
        strokeAs(g, pathCs);
        g.stroke(new Path2D(PILL_ARROW));
        g.restore();
      }
      for (const p of parts) text(g, p, p.getBoundingClientRect(), at, dpr);
    },
  );
  // Keyed by what it shows, not where: a sprite's offsets are from the
  // light's centre, which for a pill is its own centre too.
  pillCache.set(key, sprite_);
  return sprite_;
}

/**
 * A picture of a bead (src/map.css `.lt-bead-dot`): its dot, and the halo its
 * shadow rings it with, from its centre `at`.
 */
function beadSprite(
  bead: HTMLElement,
  at: { x: number; y: number },
  dpr: number,
): Sprite {
  const cs = getComputedStyle(bead);
  const box = bead.getBoundingClientRect();
  // "rgba(…) 0px 0px 0px 1.2px": the halo's colour and its spread.
  const halo =
    /^((?:[a-z-]+\([^)]*\))|#[0-9a-f]+|[a-z]+)\s+(?:-?[\d.]+px\s+){3}([\d.]+)px/i.exec(
      cs.boxShadow,
    );
  const r = box.width / 2;
  const spread = halo ? Number(halo[2]) : 0;
  const cx = box.left + r - at.x;
  const cy = box.top + r - at.y;
  const key = [dpr, r, cx, cy, cs.backgroundColor, halo?.[1], spread].join("|");
  const cached = beadCache.get(key);
  if (cached) return cached;
  const reach = r + spread + 1;
  const sprite_ = sprite(
    2 * reach,
    2 * reach,
    reach - cx,
    reach - cy,
    dpr,
    (g) => {
      if (halo && spread) {
        // A ring: a shadow is never drawn under its own box.
        g.beginPath();
        g.arc(cx, cy, r + spread, 0, 2 * Math.PI);
        g.arc(cx, cy, r, 0, 2 * Math.PI, true);
        g.fillStyle = halo[1];
        g.fill();
      }
      g.beginPath();
      g.arc(cx, cy, r, 0, 2 * Math.PI);
      g.fillStyle = cs.backgroundColor;
      g.fill();
    },
  );
  beadCache.set(key, sprite_);
  return sprite_;
}

/** A light's name and its line beside it, from its centre `at`. */
function labelSprite(
  lab: HTMLElement,
  at: { x: number; y: number },
  dpr: number,
): Sprite {
  const parts = [...lab.children].filter(
    (p) => getComputedStyle(p).display !== "none",
  );
  const boxes = parts.map((p) => p.getBoundingClientRect());
  const pad = 14;
  const left = Math.min(...boxes.map((b) => b.left)) - pad;
  const top = Math.min(...boxes.map((b) => b.top)) - pad;
  const right = Math.max(...boxes.map((b) => b.right)) + pad;
  const bottom = Math.max(...boxes.map((b) => b.bottom)) + pad;
  return sprite(right - left, bottom - top, at.x - left, at.y - top, dpr, (g) =>
    parts.forEach((p, i) => text(g, p, boxes[i], at, dpr)),
  );
}
const arrowCache = new Map<string, Sprite>();

/**
 * A picture of the light `el` as it is styled now, from its centre `at`.
 * `withLabel` false leaves its name out (a light far off the view).
 */
export function lookOf(
  el: HTMLElement,
  at: { x: number; y: number },
  dpr: number,
  withLabel: boolean,
): Look {
  const lab = el.querySelector(".lt-lab") as HTMLElement | null;
  const label =
    withLabel && lab && getComputedStyle(lab).display !== "none"
      ? labelSprite(lab, at, dpr)
      : null;
  const pill = el.querySelector<HTMLElement>(":scope > .lt-pill");
  const pillCs = pill ? getComputedStyle(pill) : null;
  if (pill && pillCs!.display !== "none" && pillCs!.visibility !== "hidden")
    return { ring: pillSprite(pill, at, dpr), arrow: null, label };
  const bead = el.querySelector<HTMLElement>(":scope > .lt-bead-dot");
  if (bead && getComputedStyle(bead).display !== "none")
    return { ring: beadSprite(bead, at, dpr), arrow: null, label: null };
  const svg = el.querySelector(":scope > svg") as SVGElement;
  const matrix = getComputedStyle(svg).transform;
  const scale =
    matrix && matrix !== "none"
      ? Math.hypot(
          ...(matrix
            .match(/-?[\d.e]+/g)!
            .slice(0, 2)
            .map(Number) as [number, number]),
        )
      : 1;
  const ringEl = svg.querySelector(".lt-ring")!;
  const strikeEl = svg.querySelector(".lt-strike")!;
  const figureEl = svg.querySelector(".lt-n")!;
  const ringCs = getComputedStyle(ringEl);
  const strikeCs = getComputedStyle(strikeEl);
  const figureCs = getComputedStyle(figureEl);
  const figure =
    figureCs.display === "none" ? "" : (figureEl.textContent ?? "");
  const strike = strikeCs.display !== "none";
  const ringKey = [
    scale,
    dpr,
    ringCs.fill,
    ringCs.stroke,
    ringCs.strokeWidth,
    ringCs.strokeDasharray,
    strike ? `${strikeCs.stroke}|${strikeCs.strokeWidth}` : "",
    figure,
    figure ? `${figureCs.fill}|${fontOf(figureCs)}` : "",
  ].join("|");
  let ring = ringCache.get(ringKey);
  if (!ring) {
    const r = (RING_R + px(ringCs.strokeWidth)) * scale + 1;
    ring = sprite(2 * r, 2 * r, r, r, dpr, (g) => {
      g.scale(scale, scale);
      g.beginPath();
      g.arc(0, 0, RING_R, 0, 2 * Math.PI);
      if (ringCs.fill !== "none") {
        g.fillStyle = ringCs.fill;
        g.fill();
      }
      if (ringCs.stroke !== "none") {
        strokeAs(g, ringCs);
        g.stroke();
      }
      if (strike) {
        strokeAs(g, strikeCs);
        g.beginPath();
        g.moveTo(-STRIKE, STRIKE);
        g.lineTo(STRIKE, -STRIKE);
        g.stroke();
      }
      if (figure) {
        g.font = fontOf(figureCs);
        g.textAlign = "center";
        g.textBaseline = "alphabetic";
        g.fillStyle = figureCs.fill;
        g.fillText(figure, 0, FIGURE_Y);
      }
    });
    ringCache.set(ringKey, ring);
  }

  // The arrow drawn turned, a picture for each heading: turned as it is
  // placed instead, its picture was resampled and its strokes softened.
  let arrow: Sprite | null = null;
  const wind = svg.querySelector(".lt-wind") as SVGGElement;
  if (getComputedStyle(wind).display !== "none") {
    const pathCs = getComputedStyle(wind.querySelector(".lt-arrow")!);
    const deg = Number(
      /rotate\((-?[\d.]+)/.exec(wind.getAttribute("transform") ?? "")?.[1] ?? 0,
    );
    const key = [scale, dpr, pathCs.stroke, pathCs.strokeWidth, deg].join("|");
    arrow = arrowCache.get(key) ?? null;
    if (!arrow) {
      const a = (deg * Math.PI) / 180;
      const turned = ARROW_POINTS.map(([x, y]) => [
        (x * Math.cos(a) - y * Math.sin(a)) * scale,
        (x * Math.sin(a) + y * Math.cos(a)) * scale,
      ]);
      const pad = (px(pathCs.strokeWidth) / 2 + 1) * scale;
      const xs = turned.map((p) => p[0]);
      const ys = turned.map((p) => p[1]);
      const left = Math.min(...xs) - pad;
      const top = Math.min(...ys) - pad;
      arrow = sprite(
        Math.max(...xs) + pad - left,
        Math.max(...ys) + pad - top,
        -left,
        -top,
        dpr,
        (g) => {
          g.scale(scale, scale);
          g.rotate(a);
          strokeAs(g, pathCs);
          g.stroke(new Path2D(ARROW));
        },
      );
      arrowCache.set(key, arrow);
    }
  }

  return { ring, arrow, label };
}

/** One light's place in a frame: where it stood at rest, and its picture. */
export interface Drawn {
  x: number;
  y: number;
  /** How far its picture stands off that place, whatever the zoom: a pill moved clear. */
  dx?: number;
  dy?: number;
  look: Look;
}

/** Every light at the frame's scale `k` and shift `tx`, `ty`, on `canvas`. */
export function drawLights(
  canvas: HTMLCanvasElement,
  lights: readonly Drawn[],
  k: number,
  tx: number,
  ty: number,
  dpr: number,
) {
  const g = canvas.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const place = (s: Sprite) => g.drawImage(s.canvas, s.x, s.y, s.w, s.h);
  for (const { x, y, dx = 0, dy = 0, look } of lights) {
    const X = k * x + tx + dx;
    const Y = k * y + ty + dy;
    if (X < -300 || Y < -60 || X > w + 300 || Y > h + 60) continue;
    g.setTransform(dpr, 0, 0, dpr, X * dpr, Y * dpr);
    if (look.arrow) place(look.arrow);
    place(look.ring);
    if (look.label) place(look.label);
  }
}
