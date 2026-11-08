import { describe, expect, it } from "vitest";
import {
  edgeGap,
  NUDGE,
  notchOf,
  PILL_GAP,
  placePills,
  type Box,
  type PillItem,
} from "./pillPlace";

const ROOM: Box = { l: 4, t: 4, r: 996, b: 796 };

const pill = (
  id: string,
  x: number,
  y: number,
  seaward: number | null = null,
  w = 80,
  h = 26,
): PillItem => ({ id, x, y, w, h, seaward });

const overlap = (a: Box, b: Box) =>
  a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

/** A seeded run of numbers, so a test's crowd is the same every time. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** `n` spots scattered within a `span`-pixel square round (500, 400). */
function crowd(n: number, span: number, seed: number): PillItem[] {
  const next = seeded(seed);
  return Array.from({ length: n }, (_, i) =>
    pill(
      `s${i}`,
      500 + (next() - 0.5) * span,
      400 + (next() - 0.5) * span,
      Math.round(next() * 360),
    ),
  );
}

describe("a pill on its own", () => {
  it("stands centred on its spot, with no notch", () => {
    const [p] = placePills([pill("a", 300, 200)], ROOM);
    expect(p.box).toEqual({ l: 260, t: 187, r: 340, b: 213 });
    expect(p.notch).toBeNull();
  });

  it("has none where its spot is off the map, though its card is in view", () => {
    expect(placePills([pill("a", -20, 200)], ROOM)).toEqual([]);
    expect(placePills([pill("a", 300, 900)], ROOM)).toEqual([]);
  });

  it("is moved in off the map's edge, its spot still in reach", () => {
    const [p] = placePills([pill("a", 10, 200)], ROOM);
    expect(p.box.l).toBeGreaterThanOrEqual(ROOM.l);
    expect(edgeGap(10, 200, p.box)).toBeLessThanOrEqual(NUDGE);
  });

  it("keeps clear of the map's controls", () => {
    const zoom: Box = { l: 940, t: 10, r: 990, b: 90 };
    const [p] = placePills([pill("a", 930, 50)], ROOM, [zoom]);
    expect(overlap(p.box, zoom)).toBe(false);
    expect(p.box.r).toBeLessThanOrEqual(zoom.l - 2);
  });
});

describe("pills of close spots", () => {
  it("never overlap, however close the spots", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const placed = placePills(crowd(8, 160, seed), ROOM);
      expect(placed).toHaveLength(8);
      for (let i = 0; i < placed.length; i++)
        for (let j = i + 1; j < placed.length; j++)
          expect(overlap(placed[i].box, placed[j].box)).toBe(false);
    }
  });

  it("keep a gap between them", () => {
    const [a, b] = placePills([pill("a", 500, 400), pill("b", 505, 402)], ROOM);
    const apart = Math.max(
      b.box.l - a.box.r,
      a.box.l - b.box.r,
      b.box.t - a.box.b,
      a.box.t - b.box.b,
    );
    expect(apart).toBeGreaterThanOrEqual(PILL_GAP);
  });

  it("each stay within the reach of its spot", () => {
    for (let seed = 1; seed <= 40; seed++)
      for (const p of placePills(crowd(6, 200, seed), ROOM))
        expect(edgeGap(p.x, p.y, p.box)).toBeLessThanOrEqual(NUDGE);
  });

  it("move the first card's pill least: it keeps its spot", () => {
    const [first, second] = placePills(
      [pill("a", 500, 400), pill("b", 510, 405)],
      ROOM,
    );
    expect(first.box).toEqual({ l: 460, t: 387, r: 540, b: 413 });
    expect(first.notch).toBeNull();
    expect(second.notch).not.toBeNull();
  });

  it("go the sea side first", () => {
    // Two spots on one point: the second's shore looks west, then east.
    const west = placePills(
      [pill("a", 500, 400), pill("b", 500, 400, 270)],
      ROOM,
    )[1];
    const east = placePills(
      [pill("a", 500, 400), pill("b", 500, 400, 90)],
      ROOM,
    )[1];
    const north = placePills(
      [pill("a", 500, 400), pill("b", 500, 400, 0)],
      ROOM,
    )[1];
    const south = placePills(
      [pill("a", 500, 400), pill("b", 500, 400, 180)],
      ROOM,
    )[1];
    const cx = (p: { box: Box }) => (p.box.l + p.box.r) / 2;
    const cy = (p: { box: Box }) => (p.box.t + p.box.b) / 2;
    expect(cy(north)).toBeLessThan(400);
    expect(cy(south)).toBeGreaterThan(400);
    // Sideways a pill's width is a long way: up or down is less, so the sea
    // to the west or east leans the move that way rather than turning it.
    expect(cx(west)).toBeLessThanOrEqual(500);
    expect(cx(east)).toBeGreaterThanOrEqual(500);
  });

  it("point a notch on the edge towards the spot", () => {
    const [, b] = placePills(
      [pill("a", 500, 400), pill("b", 500, 400, 0)],
      ROOM,
    );
    // Moved north of its spot: the notch on its foot, over the spot.
    expect(b.notch).toEqual({ side: "b", along: 40 });
  });
});

describe("the map's own names", () => {
  const dublin: Box = { l: 470, t: 392, r: 530, b: 408 };

  it("are stood clear of where a short move does it", () => {
    const [p] = placePills([pill("a", 500, 416)], ROOM, [], [dublin]);
    expect(overlap(p.box, dublin)).toBe(false);
    expect(edgeGap(500, 416, p.box)).toBeLessThanOrEqual(NUDGE);
  });

  it("never stop a pill standing by its spot", () => {
    const wide: Box = { l: 300, t: 300, r: 700, b: 500 };
    const [p] = placePills([pill("a", 500, 400)], ROOM, [], [wide]);
    expect(p.box).toEqual({ l: 460, t: 387, r: 540, b: 413 });
  });
});

describe("the same question", () => {
  it("has the same answer", () => {
    const items = crowd(10, 220, 7);
    expect(placePills(items, ROOM)).toEqual(placePills(items, ROOM));
  });

  it("whatever was placed before it", () => {
    placePills(crowd(12, 300, 3), ROOM);
    const items = crowd(5, 120, 11);
    const once = placePills(items, ROOM);
    placePills(crowd(9, 90, 5), ROOM, [], [], 20);
    expect(placePills(items, ROOM)).toEqual(once);
  });
});

describe("a notch", () => {
  const box: Box = { l: 100, t: 100, r: 180, b: 126 };

  it("is none for a spot on the pill", () => {
    expect(notchOf(140, 113, box)).toBeNull();
    expect(notchOf(140, 128, box)).toBeNull();
  });

  it("is on the edge the spot is beyond, held clear of the round ends", () => {
    expect(notchOf(140, 140, box)).toEqual({ side: "b", along: 40 });
    expect(notchOf(102, 90, box)).toEqual({ side: "t", along: 14 });
    expect(notchOf(200, 113, box)).toEqual({ side: "r", along: 13 });
    expect(notchOf(80, 100, box)).toEqual({ side: "l", along: 9 });
  });
});
