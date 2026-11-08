import { describe, expect, it } from "vitest";
import {
  DEFAULT_FIELD,
  FIELDS,
  offeredFields,
  parseMapField,
  pressField,
  shownField,
  windWith,
} from "./mapField";

describe("parseMapField", () => {
  it("opens a first visit on none", () => {
    expect(DEFAULT_FIELD).toBe("none");
    expect(parseMapField(null)).toBe("none");
    expect(parseMapField(null, { wash: false, particles: true })).toBe("none");
  });

  it("keeps the rider's choice, none too", () => {
    for (const field of [...FIELDS, "none"] as const)
      expect(parseMapField(field, { wash: true, particles: true })).toBe(field);
  });

  it("starts a rider who had Coloured wind on on Wind", () => {
    expect(parseMapField(null, { wash: true, particles: false })).toBe("wind");
    expect(parseMapField("rain", { wash: true, particles: true })).toBe("wind");
  });

  it("reads anything else as none", () => {
    expect(parseMapField("")).toBe("none");
    expect(parseMapField('"wind"')).toBe("none");
  });
});

describe("pressField", () => {
  it("turns the pressed field on, and the one on off", () => {
    expect(pressField("none", "wind")).toBe("wind");
    expect(pressField("wind", "weather")).toBe("weather");
    expect(pressField("weather", "weather")).toBe("none");
  });
});

describe("the fields offered", () => {
  it("leaves Waves out until there are wave frames", () => {
    expect(offeredFields({ waves: false })).toEqual(["wind", "weather"]);
    expect(offeredFields({ waves: true })).toEqual([
      "wind",
      "waves",
      "weather",
    ]);
  });

  it("draws none for a field not offered, and the rest as chosen", () => {
    const offered = offeredFields({ waves: false });
    expect(shownField("waves", offered)).toBe("none");
    expect(shownField("wind", offered)).toBe("wind");
    expect(shownField("none", offered)).toBe("none");
    expect(shownField("waves", offeredFields({ waves: true }))).toBe("waves");
  });
});

describe("windWith", () => {
  it("is the coloured wind under Wind alone, the particles as they were", () => {
    expect(windWith("wind", false)).toEqual({ wash: true, particles: false });
    expect(windWith("weather", true)).toEqual({ wash: false, particles: true });
    expect(windWith("none", true)).toEqual({ wash: false, particles: true });
  });
});
