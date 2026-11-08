import { describe, expect, it } from "vitest";
import {
  pillContent,
  pillFigure,
  pillHtml,
  pillKey,
  type PillReading,
} from "./pillContent";

const reading = (over: Partial<PillReading> = {}): PillReading => ({
  from: 225,
  windKn: 13.2,
  gustKn: 19.6,
  dark: false,
  sky: "cloudy",
  air: 11.6,
  rain: 0,
  sea: { height: 1.24, period: 8.4, direction: 270 },
  inland: false,
  ...over,
});

describe("with no field on", () => {
  it("is the wind's arrow, the wind with its unit, and the sky after it", () => {
    expect(pillContent("none", reading(), "kn")).toEqual({
      arrow: 45,
      sky: { icon: "cloudy", dark: false, first: false },
      figure: "13",
      unit: "kn",
      sup: null,
    });
  });

  it("says the rider's units", () => {
    expect(pillContent("none", reading(), "km/h")).toMatchObject({
      figure: "24",
      unit: "km/h",
    });
    // Force says itself, with no unit after it.
    expect(pillContent("none", reading(), "bft")).toMatchObject({
      figure: "F4",
      unit: null,
    });
  });

  it("shows the moon after dark, and rain where it rains on a clear sky", () => {
    expect(
      pillContent("none", reading({ sky: "clear", dark: true }), "kn")?.sky,
    ).toEqual({ icon: "clear", dark: true, first: false });
    expect(
      pillContent("none", reading({ sky: "partly", rain: 0.6 }), "kn")?.sky
        ?.icon,
    ).toBe("rain");
  });

  it("has no sky where none is read, and a dash with no wind", () => {
    const p = pillContent(
      "none",
      reading({ sky: null, windKn: null, from: null }),
      "kn",
    );
    expect(p).toEqual({
      arrow: null,
      sky: null,
      figure: "–",
      unit: null,
      sup: null,
    });
  });
});

describe("with Wind on", () => {
  it("is the arrow, the wind and the gust raised", () => {
    expect(pillContent("wind", reading(), "kn")).toEqual({
      arrow: 45,
      sky: null,
      figure: "13",
      unit: null,
      sup: "20",
    });
  });

  it("raises no gust where none is given", () => {
    expect(pillContent("wind", reading({ gustKn: null }), "kn")?.sup).toBe(
      null,
    );
  });
});

describe("with Waves on", () => {
  it("is the sea's arrow, its height and its period", () => {
    expect(pillContent("waves", reading(), "kn")).toEqual({
      arrow: 90,
      sky: null,
      figure: "1.2",
      unit: null,
      sup: "8s",
    });
  });

  it("is no pill at all where the sea's waves do not reach", () => {
    expect(
      pillContent("waves", reading({ inland: true, sea: null }), "kn"),
    ).toBeNull();
  });

  it("is a dash where the sea is not read yet", () => {
    expect(pillContent("waves", reading({ sea: null }), "kn")).toMatchObject({
      arrow: null,
      figure: "–",
      sup: null,
    });
  });
});

describe("with Weather on", () => {
  it("is the sky beside the air's temperature", () => {
    expect(pillContent("weather", reading(), "kn")).toEqual({
      arrow: null,
      sky: { icon: "cloudy", dark: false, first: true },
      figure: "12°",
      unit: null,
      sup: null,
    });
  });

  it("raises the rain while it rains", () => {
    expect(
      pillContent("weather", reading({ sky: "rain", rain: 1.26 }), "kn"),
    ).toMatchObject({ sky: { icon: "rain" }, sup: "1.3" });
    expect(
      pillContent("weather", reading({ rain: 0.04 }), "kn")?.sup,
    ).toBeNull();
  });
});

describe("a pill's key", () => {
  it("changes with what it says, and only then", () => {
    const a = pillContent("none", reading(), "kn");
    expect(pillKey(a)).toBe(pillKey(pillContent("none", reading(), "kn")));
    expect(pillKey(a)).not.toBe(
      pillKey(pillContent("none", reading({ windKn: 15 }), "kn")),
    );
    expect(pillKey(null)).toBe("");
  });
});

describe("a pill's markup", () => {
  it("stands its parts in the field's order", () => {
    const none = pillHtml(pillContent("none", reading(), "kn"));
    expect(none).toMatch(
      /^<svg class="lt-pa"[^]*<g transform="rotate\(45\)">[^]*<b class="lt-kn">13<\/b><span class="lt-u">kn<\/span><svg class="lt-sky"/,
    );
    const weather = pillHtml(
      pillContent("weather", reading({ rain: 0.5, sky: "rain" }), "kn"),
    );
    expect(weather).toMatch(
      /^<svg class="lt-sky"[^]*<b class="lt-kn">12°<\/b><sup class="lt-gu">0.5<\/sup>$/,
    );
  });

  it("colours the sky by class, for the stylesheet", () => {
    const html = pillHtml(pillContent("none", reading({ sky: "clear" }), "kn"));
    expect(html).toContain('class="f-sun"');
  });

  it("is nothing for no pill", () => {
    expect(pillHtml(null)).toBe("");
  });
});

describe("pillFigure", () => {
  const sample = {
    from: 270,
    windKn: 14,
    gustKn: 20,
    dark: false,
    sky: "partly" as const,
    air: 12,
    rain: 0.4,
    sea: { height: 1.6, period: 9, direction: 260 },
    inland: false,
  };
  it("ranks by what the map shows", () => {
    expect(pillFigure("none", sample)).toBe(14);
    expect(pillFigure("wind", sample)).toBe(14);
    expect(pillFigure("waves", sample)).toBe(1.6);
    expect(pillFigure("waves", { ...sample, inland: true })).toBeNull();
    expect(pillFigure("weather", sample)).toBeCloseTo(6.6);
    expect(
      pillFigure("weather", { ...sample, sky: null, rain: null }),
    ).toBeNull();
  });
});
