import { describe, expect, it } from "vitest";
import {
  bestPills,
  byBest,
  type BestCandidate,
  type BestOptions,
} from "./pillBest";

const spot = (
  id: string,
  x: number,
  y: number,
  more: Partial<BestCandidate> = {},
): BestCandidate => ({
  id,
  x,
  y,
  w: 60,
  h: 26,
  stars: 3,
  favourite: false,
  figure: 15,
  says: `${id} says`,
  name: id,
  ...more,
});

const options = (more: Partial<BestOptions> = {}): BestOptions => ({
  most: 5,
  gap: 90,
  room: { l: 4, t: 4, r: 396, b: 700 },
  walls: [],
  ...more,
});

describe("byBest", () => {
  it("puts stars first, then favourites, then the figure, then the name", () => {
    const list = [
      spot("b", 0, 0, { stars: 2, figure: 30 }),
      spot("a", 0, 0, { stars: 4 }),
      spot("d", 0, 0, { stars: 2, favourite: true, figure: 5 }),
      spot("c", 0, 0, { stars: 2, figure: 31 }),
      spot("e", 0, 0, { stars: null, figure: 40 }),
      spot("aa", 0, 0, { stars: 2, figure: 30 }),
    ].sort(byBest);
    expect(list.map((s) => s.id)).toEqual(["a", "d", "c", "aa", "b", "e"]);
  });
});

describe("bestPills", () => {
  it("gives at most five pills, the best first", () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      spot(`s${i}`, 40 + (i % 3) * 120, 60 + Math.floor(i / 3) * 120, {
        stars: i % 5,
      }),
    );
    const out = bestPills(many, options());
    expect(out).toHaveLength(5);
    expect(out.slice(0, 2)).toEqual(["s4", "s3"]);
  });

  it("keeps the spacing: a spot too close to a better one is a bead", () => {
    const out = bestPills(
      [
        spot("best", 100, 100, { stars: 5 }),
        spot("close", 160, 120, { stars: 4 }),
        spot("far", 300, 100, { stars: 1 }),
      ],
      options(),
    );
    expect(out).toEqual(["best", "far"]);
    // Wider apart on the chart.
    expect(
      bestPills(
        [spot("best", 100, 100, { stars: 5 }), spot("far", 220, 100)],
        options({ gap: 140 }),
      ),
    ).toEqual(["best"]);
  });

  it("allows no two neighbours that say the same", () => {
    const same = { says: "↗ 13 kn" };
    const out = bestPills(
      [
        spot("a", 50, 100, { stars: 5, ...same }),
        spot("twin", 150, 100, { stars: 4, ...same }),
        spot("other", 150, 250, { stars: 3 }),
        spot("far twin", 300, 400, { stars: 2, ...same }),
      ],
      options(),
    );
    expect(out).toEqual(["a", "other", "far twin"]);
  });

  it("leaves off a pill the map has no room for, or a control stands on", () => {
    const out = bestPills(
      [
        spot("edge", 10, 100, { stars: 5 }),
        spot("dock", 200, 690, { stars: 5 }),
        spot("walled", 200, 300, { stars: 5 }),
        spot("fine", 200, 100, { stars: 1 }),
      ],
      options({ walls: [{ l: 180, t: 280, r: 240, b: 320 }] }),
    );
    expect(out).toEqual(["fine"]);
  });

  it("always keeps the spot the rider is at, first", () => {
    const out = bestPills(
      [
        spot("best", 100, 100, { stars: 5 }),
        spot("mine", 130, 110, { stars: 0 }),
      ],
      options({ keep: "mine" }),
    );
    expect(out).toEqual(["mine"]);
  });

  it("gives a spot with nothing to say no pill", () => {
    expect(
      bestPills([spot("inland", 100, 100, { says: "" })], options()),
    ).toEqual([]);
  });

  it("answers the same question the same way", () => {
    const list = Array.from({ length: 20 }, (_, i) =>
      spot(`s${i}`, (i * 37) % 380, (i * 53) % 680, { stars: i % 3 }),
    );
    expect(bestPills(list, options())).toEqual(
      bestPills([...list].reverse(), options()),
    );
  });
});
