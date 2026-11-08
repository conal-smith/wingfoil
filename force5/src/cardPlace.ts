/**
 * Where a spot's card stands beside its pill on the full chart: on the side
 * with room, the sea side first and beside it rather than above or below, a
 * small pointer on the card's edge at the pill, and never over the pill. The
 * card stays inside the map, above its dock, and off the map's controls.
 *
 * Pure: the pill's box, the card's size and the room in, the card's box and
 * its pointer out.
 */
import type { Box } from "./pillPlace";

export interface CardPlace {
  box: Box;
  /** The card's edge facing the pill: right, left, bottom, top of the pill. */
  side: "r" | "l" | "b" | "t";
  /** How far along that edge the pointer stands, in pixels. */
  along: number;
}

/** The room between the pill and the card, for the pointer. */
const GAP = 10;
/** How near the card's corner its pointer may stand. */
const END = 18;

const hits = (a: Box, b: Box, pad: number) =>
  a.l < b.r + pad && b.l < a.r + pad && a.t < b.b + pad && b.t < a.b + pad;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), Math.max(lo, hi));

export function placeCard(
  pill: Box,
  w: number,
  h: number,
  room: Box,
  walls: readonly Box[],
  /** The bearing the spot's shore looks out to sea along, or null. */
  seaward: number | null,
): CardPlace | null {
  const cx = (pill.l + pill.r) / 2;
  const cy = (pill.t + pill.b) / 2;
  const sea = ((seaward ?? 270) * Math.PI) / 180;
  const toSea = [Math.sin(sea), -Math.cos(sea)];
  const ways = { r: [1, 0], l: [-1, 0], b: [0, 1], t: [0, -1] } as const;
  const options: (CardPlace & { fits: boolean; score: number })[] = [];
  for (const side of ["r", "l", "b", "t"] as const) {
    let l: number;
    let t: number;
    let along: number;
    if (side === "r" || side === "l") {
      l = side === "r" ? pill.r + GAP : pill.l - GAP - w;
      t = clamp(cy - h / 2, room.t, room.b - h);
      along = cy - t;
      if (along < END || along > h - END) continue;
    } else {
      t = side === "b" ? pill.b + GAP : pill.t - GAP - h;
      l = clamp(cx - w / 2, room.l, room.r - w);
      along = cx - l;
      if (along < END || along > w - END) continue;
    }
    const box = { l, t, r: l + w, b: t + h };
    const fits =
      box.l >= room.l &&
      box.r <= room.r &&
      box.t >= room.t &&
      box.b <= room.b &&
      !walls.some((wall) => hits(wall, box, 6));
    const [x, y] = ways[side];
    options.push({
      box,
      side,
      along,
      fits,
      score:
        x * toSea[0] + y * toSea[1] + (side === "r" || side === "l" ? 0.35 : 0),
    });
  }
  const best = [...options].sort(
    (a, b) => Number(b.fits) - Number(a.fits) || b.score - a.score,
  )[0];
  return best ? { box: best.box, side: best.side, along: best.along } : null;
}
