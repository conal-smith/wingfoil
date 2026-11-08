/**
 * Where the finder's pills stand on the map beside the list (./lights.ts).
 *
 * Every card the rider can see in the list has its pill, always: none is left
 * off because a neighbour is close, reads the same or stands on it. A pill
 * stands centred on its spot, with no dot under it and no line to it. Where
 * two spots are close enough for their pills to touch, each pill is moved the
 * least it must to stand clear, the sea side first (a spot's `seaward`, the
 * way its shore looks out), and never more than `NUDGE` pixels from its spot:
 * the spot stays within that reach of the pill's nearest edge. A pill moved off
 * its spot keeps a small notch on the edge facing it, pointing at the spot.
 *
 * Pills are placed in the list's order, so the first card's pill moves least.
 * They keep clear of the map's own controls (`walls`) and inside its `room`,
 * and off the map's own names (`avoid`) where a move of a few pixels more
 * clears them: a name is not a reason to leave a spot, only to choose a side.
 * Only where the spots are so packed that no place within the reach is clear
 * does a pill reach further, and only where none is clear at twice that does
 * it stand on its spot over another.
 *
 * Pure, and the same answer for the same question: placed again whenever the
 * camera rests or the cards in view change, never through a move.
 */

/** A box on the screen, in CSS pixels from the map's top left corner. */
export interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

/** A pill to place: its spot on the screen, its size, and its sea side. */
export interface PillItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The bearing the spot's shore looks out to sea along, or null. */
  seaward: number | null;
}

/** Which edge of a pill its notch is on, and how far along that edge. */
export interface Notch {
  side: "t" | "r" | "b" | "l";
  along: number;
}

export interface PlacedPill {
  id: string;
  /** Its spot, as it was given. */
  x: number;
  y: number;
  box: Box;
  /** Null for a pill standing on its spot. */
  notch: Notch | null;
}

/** How far a pill may move off its spot: the spot to the pill's nearest edge. */
export const NUDGE = 40;
/** The least room between two pills. */
export const PILL_GAP = 3;
/** The least room between a pill and one of the map's controls. */
const WALL_GAP = 2;
/** How much the sea side counts for, in pixels of a move. */
const SEA_PULL = 10;
/** What standing on one of the map's names costs, in pixels of a move. */
const ON_NAME = 24;
/** The grid the moves are tried on, in pixels. */
const STEP = 3;
/** Within this of its spot's nearest edge a pill has no notch: it is on it. */
const ON_SPOT = 3;

const hits = (a: Box, b: Box, gap: number) =>
  a.l < b.r + gap && b.l < a.r + gap && a.t < b.b + gap && b.t < a.b + gap;

const inside = (box: Box, room: Box) =>
  box.l >= room.l && box.r <= room.r && box.t >= room.t && box.b <= room.b;

/** How far a point is from a box's nearest edge, 0 inside it. */
export function edgeGap(x: number, y: number, box: Box): number {
  const nx = Math.min(box.r, Math.max(box.l, x));
  const ny = Math.min(box.b, Math.max(box.t, y));
  return Math.hypot(nx - x, ny - y);
}

/** The moves tried, nearest first, out to `reach` past a pill's half size. */
const movesCache = new Map<string, [number, number, number][]>();
function moves(w: number, h: number, reach: number) {
  const mx = Math.ceil((w / 2 + reach) / STEP) * STEP;
  const my = Math.ceil((h / 2 + reach) / STEP) * STEP;
  const key = `${mx}|${my}`;
  let out = movesCache.get(key);
  if (out) return out;
  out = [];
  for (let dx = -mx; dx <= mx; dx += STEP)
    for (let dy = -my; dy <= my; dy += STEP)
      out.push([dx, dy, Math.hypot(dx, dy)]);
  // A stable sort: equal moves keep the grid's order, so a tie always breaks
  // the same way.
  out.sort((a, b) => a[2] - b[2]);
  movesCache.set(key, out);
  return out;
}

/** The notch on a pill's edge towards its spot, or null where it is on it. */
export function notchOf(x: number, y: number, box: Box): Notch | null {
  if (edgeGap(x, y, box) <= ON_SPOT) return null;
  const hw = (box.r - box.l) / 2;
  const hh = (box.b - box.t) / 2;
  const dx = x - (box.l + hw);
  const dy = y - (box.t + hh);
  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(Math.max(v, lo), Math.max(lo, hi));
  // The edge the spot is beyond, by the pill's own proportions; along it,
  // held clear of the rounded ends.
  if (Math.abs(dx) / hw > Math.abs(dy) / hh)
    return {
      side: dx > 0 ? "r" : "l",
      along: clamp(y - box.t, Math.min(9, hh), 2 * hh - Math.min(9, hh)),
    };
  return {
    side: dy > 0 ? "b" : "t",
    along: clamp(x - box.l, Math.min(14, hw), 2 * hw - Math.min(14, hw)),
  };
}

/**
 * The best clear box for one pill within `reach` of its spot, or null: the
 * least move, less a little for a move towards the sea.
 */
function bestBox(
  item: PillItem,
  reach: number,
  room: Box,
  walls: readonly Box[],
  placed: readonly Box[],
  avoid: readonly Box[],
): Box | null {
  const { x, y, w, h } = item;
  const sea = item.seaward === null ? null : (item.seaward * Math.PI) / 180;
  const ux = sea === null ? 0 : Math.sin(sea);
  const uy = sea === null ? 0 : -Math.cos(sea);
  let best: Box | null = null;
  let cost = Infinity;
  for (const [dx, dy, r] of moves(w, h, reach)) {
    // Sorted by distance: nothing further can cost less.
    if (r - SEA_PULL > cost) break;
    const box = {
      l: x + dx - w / 2,
      t: y + dy - h / 2,
      r: x + dx + w / 2,
      b: y + dy + h / 2,
    };
    if (edgeGap(x, y, box) > reach) continue;
    if (!inside(box, room)) continue;
    if (walls.some((wall) => hits(wall, box, WALL_GAP))) continue;
    if (placed.some((other) => hits(other, box, PILL_GAP))) continue;
    const c =
      r -
      (r ? (SEA_PULL * (dx * ux + dy * uy)) / r : 0) +
      (avoid.some((name) => hits(name, box, 0)) ? ON_NAME : 0);
    if (c < cost) {
      cost = c;
      best = box;
    }
  }
  return best;
}

/**
 * Each pill's box, in the order given. A pill whose spot is outside `room`
 * has none: its card is in view, its spot is not.
 */
export function placePills(
  items: readonly PillItem[],
  room: Box,
  walls: readonly Box[] = [],
  avoid: readonly Box[] = [],
  nudge = NUDGE,
): PlacedPill[] {
  const out: PlacedPill[] = [];
  const placed: Box[] = [];
  for (const item of items) {
    const { x, y, w, h } = item;
    if (x < room.l || x > room.r || y < room.t || y > room.b) continue;
    const box = bestBox(item, nudge, room, walls, placed, avoid) ??
      // Packed tighter than the reach allows: further, and only then over
      // another, on its spot.
      bestBox(item, 2 * nudge, room, walls, placed, avoid) ?? {
        l: x - w / 2,
        t: y - h / 2,
        r: x + w / 2,
        b: y + h / 2,
      };
    placed.push(box);
    out.push({ id: item.id, x, y, box, notch: notchOf(x, y, box) });
  }
  return out;
}
