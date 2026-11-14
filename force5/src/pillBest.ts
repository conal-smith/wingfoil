/**
 * Which spots get a pill where no list stands beside the map: the phone's map
 * and the full chart (./lights.ts). There the map has room for a few pills
 * only, so it gives them to the best spots in view, at most `most` of them,
 * and every other spot is a bead.
 *
 * The best first: the most stars at the hour, then the rider's favourites,
 * then the figure the map shows (the wind, the waves or the sky), then the
 * name, so the same question always has the same answer. A spot is passed
 * over where its pill would not fit on the map clear of its controls, or
 * would stand within `gap` pixels of one already chosen (spot to spot), or
 * within twice that of one that says the same: a pill reading as its
 * neighbour does tells the rider nothing new. The spot the rider is at
 * (`keep`) always has its pill, and is placed first.
 *
 * Pure: chosen again only when the camera rests somewhere new or the field
 * changes, never through a scrub of the hours, so the pills hold still while
 * what they say changes.
 */
import type { Box } from "./pillPlace";

/** A spot in view that could have a pill. */
export interface BestCandidate {
  id: string;
  /** Its place on the screen, in CSS pixels from the map's top left. */
  x: number;
  y: number;
  /** Its pill's size. */
  w: number;
  h: number;
  /** Its stars at the hour, or null in the dark or before it is rated. */
  stars: number | null;
  /** One of the rider's favourites. */
  favourite: boolean;
  /** The map's own figure for it: the wind, the wave height, the sky. */
  figure: number | null;
  /** What its pill says, to tell two that say the same. */
  says: string;
  /** Its name, the last word on a tie. */
  name: string;
}

export interface BestOptions {
  /** How many pills at most. */
  most: number;
  /** The least distance between two pills' spots. */
  gap: number;
  /** Where a pill may stand: inside the map, above its dock. */
  room: Box;
  /** The map's own controls, which no pill stands on. */
  walls: readonly Box[];
  /** The spot the rider is at, which always has its pill. */
  keep?: string | null;
}

/** On the phone the pills may stand closer; the chart's spread wider. */
export const PHONE_GAP = 90;
export const WIDE_GAP = 140;
/** The most pills where no list stands beside the map. */
export const BEST_PILLS = 5;

const hits = (a: Box, b: Box, pad: number) =>
  a.l < b.r + pad && b.l < a.r + pad && a.t < b.b + pad && b.t < a.b + pad;

/** The order the spots are offered pills in, the best first. */
export function byBest(a: BestCandidate, b: BestCandidate): number {
  return (
    (b.stars ?? -1) - (a.stars ?? -1) ||
    Number(b.favourite) - Number(a.favourite) ||
    (b.figure ?? -Infinity) - (a.figure ?? -Infinity) ||
    a.name.localeCompare(b.name) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** The spots that get a pill, the best first. */
export function bestPills(
  candidates: readonly BestCandidate[],
  { most, gap, room, walls, keep = null }: BestOptions,
): string[] {
  const fits = (c: BestCandidate) => {
    const box = {
      l: c.x - c.w / 2,
      t: c.y - c.h / 2,
      r: c.x + c.w / 2,
      b: c.y + c.h / 2,
    };
    return (
      box.l >= room.l &&
      box.r <= room.r &&
      box.t >= room.t &&
      box.b <= room.b &&
      !walls.some((wall) => hits(wall, box, 2))
    );
  };
  const kept = keep ? candidates.find((c) => c.id === keep) : undefined;
  const chosen: BestCandidate[] = kept ? [kept] : [];
  const ranked = candidates.filter((c) => c !== kept && c.says).sort(byBest);
  for (const c of ranked) {
    if (chosen.length >= most) break;
    if (!fits(c)) continue;
    const near = chosen.some((k) => {
      const d = Math.hypot(k.x - c.x, k.y - c.y);
      return d < gap || (d < gap * 2 && k.says === c.says);
    });
    if (!near) chosen.push(c);
  }
  return chosen.map((c) => c.id);
}
