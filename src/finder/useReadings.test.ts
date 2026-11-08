import { describe, expect, it } from "vitest";
import { waveManifest, weatherManifest } from "../../force5/src/testing";
import { readingsFor } from "./useReadings";

// The test runs' own clock: three-hourly steps from 18:00 UTC on 16 September.
const at = (hour: number) =>
  new Date(Date.parse("2026-09-16T18:00:00Z") + hour * 3600000).toISOString();

describe("a card's readings", () => {
  it("are the dock's: the sky's code, the air, the cloud, the rain, and the sea's height, period and direction", () => {
    const read = readingsFor([waveManifest()], [weatherManifest()], "brandon", [
      at(0),
      at(3),
      at(6),
    ]);
    // ww 3 is cloudy; 61 slight rain.
    expect(read.sky.map((s) => s?.icon)).toEqual(["cloudy", "rain", "rain"]);
    expect(read.air).toEqual([15, 15.3, 15.6]);
    // The whole cover, per cent, and the rain in the step ending there (none
    // given for the first step, which ends no step).
    expect(read.cloud).toEqual([97, 97, 97]);
    expect(read.rain).toEqual([null, 0.3, 0.3]);
    expect(read.sea).toEqual([
      { height: 1, period: 9, direction: 300 },
      { height: 1.3, period: 9, direction: 300 },
      { height: 1.6, period: 9, direction: 300 },
    ]);
    expect(read.inland).toBe(false);
  });

  it("are nothing where no step is near, and nothing for a place no run reaches", () => {
    const read = readingsFor([waveManifest()], [weatherManifest()], "brandon", [
      at(30),
    ]);
    expect(read.sky).toEqual([null]);
    expect(read.air).toEqual([null]);
    expect(read.cloud).toEqual([null]);
    expect(read.rain).toEqual([null]);
    expect(read.sea).toEqual([null]);
    const none = readingsFor([waveManifest()], [weatherManifest()], "nowhere", [
      at(0),
    ]);
    expect(none).toEqual({
      sky: [],
      air: [],
      cloud: [],
      rain: [],
      sea: [],
      inland: false,
    });
  });

  it("say a place is inland where the weather reaches it and, the wave runs read, none of them does", () => {
    const lough = readingsFor(
      [waveManifest()],
      [weatherManifest({ spotId: "lough-ree" })],
      "lough-ree",
      [at(0)],
    );
    expect(lough.air).toEqual([15]);
    expect(lough.sea).toEqual([]);
    expect(lough.inland).toBe(true);
  });

  it("never say inland before the wave runs are read", () => {
    const early = readingsFor([], [weatherManifest()], "brandon", [at(0)]);
    expect(early.sea).toEqual([]);
    expect(early.inland).toBe(false);
  });
});
