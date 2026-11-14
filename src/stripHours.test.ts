import { describe, expect, it } from "vitest";
import { fold } from "../shared/web/afterDark";
import {
  HOURS_ACROSS,
  MAX_HOUR_PX,
  dayAway,
  hourWidth,
  hourWords,
  nearestIndex,
  notches,
} from "./stripHours";

const HOUR = 3600000;
// Sunday 13 September 2026, 00:00 Irish summer time (23:00 UTC the day before).
const MIDNIGHT = Date.parse("2026-09-12T23:00:00Z");

describe("hourWidth", () => {
  it("puts about eight hours across a phone", () => {
    const width = 366;
    expect(width / hourWidth(width)).toBeCloseTo(HOURS_ACROSS, 0);
    expect(width / hourWidth(width)).toBeGreaterThanOrEqual(6);
    expect(width / hourWidth(width)).toBeLessThanOrEqual(10);
  });

  it("puts a day or so across a desk's screen, never a week", () => {
    const hours = 1360 / hourWidth(1360);
    expect(hours).toBeGreaterThan(18);
    expect(hours).toBeLessThan(36);
  });

  it("has a width before the strip is measured", () => {
    expect(hourWidth(0)).toBe(MAX_HOUR_PX);
  });
});

describe("notches", () => {
  it("has a notch every hour, a figure every third, and the day's name where a day begins", () => {
    const marks = notches(MIDNIGHT + 20 * HOUR, MIDNIGHT + 27 * HOUR);
    expect(marks.map((m) => m.kind)).toEqual([
      "hour",
      "label",
      "hour",
      "hour",
      "day",
      "hour",
      "hour",
      "label",
    ]);
    expect(marks.map((m) => m.text)).toEqual([
      "",
      "21",
      "",
      "",
      "Mon 14",
      "",
      "",
      "03",
    ]);
  });

  it("starts at the first whole hour", () => {
    const marks = notches(MIDNIGHT + 8.5 * HOUR, MIDNIGHT + 10 * HOUR);
    expect(marks.map((m) => m.time)).toEqual([
      MIDNIGHT + 9 * HOUR,
      MIDNIGHT + 10 * HOUR,
    ]);
    expect(marks[0].text).toBe("09");
  });

  it("leaves out the hours folded out of the strip, naming the day at its first hour kept", () => {
    const line = fold([
      { from: MIDNIGHT + 7 * HOUR, to: MIDNIGHT + 20 * HOUR },
      { from: MIDNIGHT + 31 * HOUR, to: MIDNIGHT + 44 * HOUR },
    ]);
    const marks = notches(MIDNIGHT + 18 * HOUR, MIDNIGHT + 32 * HOUR, line);
    expect(marks.map((m) => m.time)).toEqual([
      MIDNIGHT + 18 * HOUR,
      MIDNIGHT + 19 * HOUR,
      MIDNIGHT + 31 * HOUR,
      MIDNIGHT + 32 * HOUR,
    ]);
    expect(marks[2]).toMatchObject({ kind: "day", text: "Mon 14" });
  });
});

describe("hourWords", () => {
  it("names today, tomorrow, and the days after by their names", () => {
    const now = MIDNIGHT + 14 * HOUR;
    expect(hourWords(MIDNIGHT + 16 * HOUR, now)).toBe("Today 16:00");
    expect(hourWords(MIDNIGHT + 33 * HOUR, now)).toBe("Tomorrow 09:00");
    expect(hourWords(MIDNIGHT + 57 * HOUR, now)).toBe("Tue 09:00");
  });
});

describe("nearestIndex and dayAway", () => {
  const times = [0, 1, 2, 3, 6, 9, 12, 24, 27, 48].map((h) => h * HOUR);

  it("finds the nearest stop either way, the earlier at a tie", () => {
    expect(nearestIndex(times, -5 * HOUR)).toBe(0);
    expect(nearestIndex(times, 4 * HOUR)).toBe(3);
    expect(nearestIndex(times, 4.6 * HOUR)).toBe(4);
    expect(nearestIndex(times, 4.5 * HOUR)).toBe(3);
    expect(nearestIndex(times, 100 * HOUR)).toBe(times.length - 1);
    expect(nearestIndex([], 0)).toBe(-1);
  });

  it("steps a day to the stop nearest the same time, held inside the strip", () => {
    expect(dayAway(times, 3, 1)).toBe(8);
    expect(dayAway(times, 8, -1)).toBe(3);
    expect(dayAway(times, 9, 1)).toBe(9);
    expect(dayAway(times, 0, -1)).toBe(0);
  });
});
