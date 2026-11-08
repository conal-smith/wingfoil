import { describe, expect, it } from "vitest";
import {
  dayNights,
  formatLocal,
  sunElevation,
  sunElevationAt,
  sunTimes,
} from "./sun";

const BRANDON = { lat: 52.276, lon: -10.024 };
const minutes = (date: Date) =>
  date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
const closeTo = (date: Date | null, hhmm: string, toleranceMinutes = 3) => {
  const [hours, mins] = hhmm.split(":").map(Number);
  expect(date).not.toBeNull();
  expect(Math.abs(minutes(date!) - (hours * 60 + mins))).toBeLessThanOrEqual(
    toleranceMinutes,
  );
};

describe("sun times", () => {
  it("matches published Brandon Bay times in mid-September", () => {
    const day = sunTimes(
      BRANDON.lat,
      BRANDON.lon,
      new Date("2026-09-14T12:00:00Z"),
    );
    expect(day.date).toBe("2026-09-14");
    closeTo(day.sunrise, "06:12");
    closeTo(day.sunset, "18:59");
    closeTo(day.solarNoon, "12:35");
    expect(day.civilDawn!.getTime()).toBeLessThan(day.sunrise!.getTime());
    expect(day.civilDusk!.getTime()).toBeGreaterThan(day.sunset!.getTime());
    closeTo(day.civilDawn, "05:39", 5);
    closeTo(day.civilDusk, "19:32", 5);
    expect(day.polar).toBeNull();
  });
  it("matches published Dublin solstice times", () => {
    // Dublin (53.35, -6.26): 04:56/21:57 IST in June, 08:38/16:08 GMT in December.
    const june = sunTimes(53.35, -6.26, new Date("2026-06-21T12:00:00Z"));
    closeTo(june.sunrise, "03:56", 2);
    closeTo(june.sunset, "20:57", 2);
    const december = sunTimes(53.35, -6.26, new Date("2026-12-21T12:00:00Z"));
    closeTo(december.sunrise, "08:38", 2);
    closeTo(december.sunset, "16:08", 2);
  });
  it("gives Brandon Bay a long June day and a short December one", () => {
    const hours = (date: Date) =>
      sunTimes(BRANDON.lat, BRANDON.lon, date).sunset!.getTime() -
      sunTimes(BRANDON.lat, BRANDON.lon, date).sunrise!.getTime();
    const june = hours(new Date("2026-06-21T12:00:00Z")) / 3600000;
    const december = hours(new Date("2026-12-21T12:00:00Z")) / 3600000;
    expect(june).toBeCloseTo(16.79, 1);
    expect(december).toBeCloseTo(7.69, 1);
  });
  it("uses the UTC day of the given instant, whatever the local hour", () => {
    const late = sunTimes(
      BRANDON.lat,
      BRANDON.lon,
      new Date("2026-09-14T23:30:00Z"),
    );
    expect(late.date).toBe("2026-09-14");
    const early = sunTimes(
      BRANDON.lat,
      BRANDON.lon,
      new Date("2026-09-14T00:10:00Z"),
    );
    expect(early.sunrise!.toISOString()).toBe(late.sunrise!.toISOString());
  });
  it("reports polar day and night instead of inventing an event", () => {
    const north = sunTimes(78, 15, new Date("2026-06-21T00:00:00Z"));
    expect(north.sunrise).toBeNull();
    expect(north.polar).toBe("day");
    const winter = sunTimes(78, 15, new Date("2026-12-21T00:00:00Z"));
    expect(winter.sunset).toBeNull();
    expect(winter.polar).toBe("night");
  });
});

describe("the sun's height", () => {
  const DUBLIN = { lat: 53.35, lon: -6.26 };
  it("stands at 90° less the latitude, plus the declination, at noon", () => {
    // Midsummer: 90 - 53.35 + 23.44; midwinter: 90 - 53.35 - 23.44.
    const june = sunTimes(
      DUBLIN.lat,
      DUBLIN.lon,
      new Date("2026-06-21T12:00Z"),
    );
    const december = sunTimes(
      DUBLIN.lat,
      DUBLIN.lon,
      new Date("2026-12-21T12:00Z"),
    );
    expect(
      sunElevation(DUBLIN.lat, DUBLIN.lon, june.solarNoon.getTime()),
    ).toBeCloseTo(60.09, 0);
    expect(
      sunElevation(DUBLIN.lat, DUBLIN.lon, december.solarNoon.getTime()),
    ).toBeCloseTo(13.21, 0);
  });
  it("is at the horizon at sunset and 6° under it at civil dusk", () => {
    const day = sunTimes(
      BRANDON.lat,
      BRANDON.lon,
      new Date("2026-09-14T12:00:00Z"),
    );
    // Sunset is the disc's top on the horizon seen through the air: the
    // centre geometrically 0.833° under it. The day's times take the sun's
    // declination at noon, so they agree to a tenth of a degree or so.
    const at = (date: Date | null) =>
      sunElevation(BRANDON.lat, BRANDON.lon, date!.getTime());
    expect(Math.abs(at(day.sunset) + 0.833)).toBeLessThan(0.15);
    expect(Math.abs(at(day.civilDusk) + 6)).toBeLessThan(0.15);
    expect(Math.abs(at(day.sunrise) + 0.833)).toBeLessThan(0.15);
  });
  it("is far under the horizon at midnight in winter", () => {
    const elevation = sunElevation(
      DUBLIN.lat,
      DUBLIN.lon,
      Date.parse("2026-12-21T00:25:00Z"),
    );
    expect(elevation).toBeLessThan(-55);
  });
  it("sets in the east first: the same instant, Dublin darker than Brandon", () => {
    const at = sunElevationAt(Date.parse("2026-12-21T16:30:00Z"));
    expect(at(DUBLIN.lat, DUBLIN.lon)).toBeLessThan(
      at(BRANDON.lat, BRANDON.lon),
    );
    expect(at(BRANDON.lat, BRANDON.lon)).toBe(
      sunElevation(
        BRANDON.lat,
        BRANDON.lon,
        Date.parse("2026-12-21T16:30:00Z"),
      ),
    );
  });
});

describe("night shading", () => {
  it("returns merged night intervals clipped to the window", () => {
    const from = new Date("2026-09-14T00:00:00Z");
    const to = new Date("2026-09-16T00:00:00Z");
    const nights = dayNights(BRANDON.lat, BRANDON.lon, from, to);
    expect(nights).toHaveLength(3);
    expect(nights[0].from.getTime()).toBe(from.getTime());
    closeTo(nights[0].to, "06:12");
    closeTo(nights[1].from, "18:59");
    closeTo(nights[1].to, "06:14");
    expect(nights.at(-1)!.to.getTime()).toBe(to.getTime());
    for (const night of nights)
      expect(night.to.getTime()).toBeGreaterThan(night.from.getTime());
  });
  it("shades less when asked for civil darkness only", () => {
    const from = new Date("2026-09-14T00:00:00Z");
    const to = new Date("2026-09-15T00:00:00Z");
    const sun = dayNights(BRANDON.lat, BRANDON.lon, from, to);
    const civil = dayNights(BRANDON.lat, BRANDON.lon, from, to, {
      boundary: "civil",
    });
    const total = (intervals: { from: Date; to: Date }[]) =>
      intervals.reduce(
        (sum, night) => sum + night.to.getTime() - night.from.getTime(),
        0,
      );
    expect(total(civil)).toBeLessThan(total(sun));
  });
  it("handles an empty or inverted window", () => {
    const day = new Date("2026-09-14T12:00:00Z");
    expect(dayNights(BRANDON.lat, BRANDON.lon, day, day)).toEqual([]);
    expect(
      dayNights(
        BRANDON.lat,
        BRANDON.lon,
        day,
        new Date("2026-09-13T12:00:00Z"),
      ),
    ).toEqual([]);
  });
});

describe("local formatting", () => {
  it("shows Irish time, an hour ahead of UTC in September", () => {
    expect(formatLocal(new Date("2026-09-14T06:12:00Z"))).toBe("07:12");
    expect(formatLocal(new Date("2026-01-14T06:12:00Z"))).toBe("06:12");
    expect(
      formatLocal(new Date("2026-09-14T06:12:00Z"), {
        weekday: "short",
        hour: undefined,
        minute: undefined,
      }),
    ).toBe("Mon");
  });
});
