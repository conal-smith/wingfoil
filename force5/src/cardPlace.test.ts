import { describe, expect, it } from "vitest";
import { placeCard } from "./cardPlace";

const room = { l: 10, t: 10, r: 990, b: 690 };
const pill = { l: 480, t: 340, r: 540, b: 366 };
const overlaps = (
  a: { l: number; t: number; r: number; b: number },
  b: typeof a,
) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

describe("placeCard", () => {
  it("stands beside the pill on the sea side, never over it", () => {
    const west = placeCard(pill, 256, 180, room, [], 270)!;
    expect(west.side).toBe("l");
    expect(west.box.r).toBeLessThan(pill.l);
    expect(overlaps(west.box, pill)).toBe(false);
    const east = placeCard(pill, 256, 180, room, [], 90)!;
    expect(east.side).toBe("r");
    expect(east.box.l).toBeGreaterThan(pill.r);
  });

  it("takes another side where the first has no room", () => {
    const edge = { l: 20, t: 340, r: 80, b: 366 };
    const card = placeCard(edge, 256, 180, room, [], 270)!;
    expect(card.side).not.toBe("l");
    expect(card.box.l).toBeGreaterThanOrEqual(room.l);
    expect(overlaps(card.box, edge)).toBe(false);
  });

  it("keeps clear of the map's controls", () => {
    const wall = { l: 180, t: 200, r: 470, b: 500 };
    const card = placeCard(pill, 256, 180, room, [wall], 270)!;
    expect(card.side).not.toBe("l");
    expect(overlaps(card.box, wall)).toBe(false);
  });

  it("points at the pill", () => {
    const card = placeCard(pill, 256, 180, room, [], 270)!;
    expect(card.box.t + card.along).toBeCloseTo((pill.t + pill.b) / 2);
  });
});
