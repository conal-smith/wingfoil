import {
  createPropertyExpression,
  featureFilter,
  latest,
  validateStyleMin,
} from "@maplibre/maplibre-gl-style-spec";
import type { FilterSpecification, LayerSpecification } from "maplibre-gl";
import { describe, expect, it } from "vitest";
import {
  CHART_LAYERS,
  chartColours,
  chartStyle,
  INLAND_QUIET_UNTIL,
  LAKE_WASH,
} from "./chartStyle";

const colours = chartColours({ getPropertyValue: () => "#123456" });

const ARCHIVE = "pmtiles://https://data.example.com/bathy/v0/ireland.pmtiles";

const depthLayers = (style: ReturnType<typeof chartStyle>) =>
  style.layers.filter((layer) => "source" in layer && layer.source === "bathy");

describe("chartStyle", () => {
  it("switches every layer drawn from the depth archive together", () => {
    expect(
      depthLayers(chartStyle(colours, ARCHIVE))
        .map((l) => l.id)
        .sort(),
    ).toEqual([...CHART_LAYERS.depths].sort());
  });

  it("draws the depths from the archive it is given", () => {
    const style = chartStyle(colours, ARCHIVE);
    expect(style.sources.bathy).toMatchObject({ type: "vector", url: ARCHIVE });
    for (const layer of depthLayers(style))
      expect(layer.layout?.visibility, layer.id).toBeUndefined();
  });

  it("with no archive, names none and hides the depths, so nothing is read", () => {
    const style = chartStyle(colours, null);
    expect(style.sources.bathy).not.toHaveProperty("url");
    expect(style.sources.bathy).not.toHaveProperty("tiles");
    const hidden = depthLayers(style);
    expect(hidden).toHaveLength(CHART_LAYERS.depths.length);
    for (const layer of hidden)
      expect(layer.layout?.visibility, layer.id).toBe("none");
    // The soundings keep their own layout beside it.
    expect(
      hidden.find((layer) => layer.id === "soundings")?.layout,
    ).toMatchObject({ "text-field": ["get", "label"] });
  });

  it("is a valid style", () => {
    expect(validateStyleMin(chartStyle(colours, ARCHIVE))).toEqual([]);
  });
});

describe("the water at country zoom", () => {
  const style = chartStyle(colours, null);
  const layer = (id: string) =>
    style.layers.find((l) => l.id === id) as LayerSpecification & {
      filter?: FilterSpecification;
      paint: Record<string, unknown>;
      minzoom?: number;
    };
  /** A water polygon as OpenMapTiles carries it: a class, maybe intermittent. */
  const water = (cls: string, intermittent = 0) => ({
    type: 2 as const,
    properties: { class: cls, intermittent },
    geometry: [],
  });
  /** Does a layer's filter draw this feature? */
  const draws = (id: string, feature: ReturnType<typeof water>) =>
    featureFilter(layer(id).filter, `layers.${id}.filter`).filter(
      { zoom: 10 },
      feature as never,
    );
  const opacity = (zoom: number, feature: ReturnType<typeof water>) => {
    const parsed = createPropertyExpression(
      layer("water").paint["fill-opacity"],
      "layers.water.paint.fill-opacity",
      latest.paint_fill["fill-opacity"] as never,
    );
    if (parsed.result !== "success") throw new Error("bad expression");
    return parsed.value.evaluate({ zoom }, feature as never);
  };

  it("draws the coast round the sea alone: no lough, pond or river", () => {
    expect(draws("coast", water("ocean"))).toBe(true);
    for (const cls of ["lake", "pond", "river"])
      expect(draws("coast", water(cls)), cls).toBe(false);
  });

  it("washes the loughs faintly until close in, and fills the sea whole", () => {
    for (const zoom of [5, 6.3, INLAND_QUIET_UNTIL]) {
      expect(opacity(zoom, water("ocean"))).toBe(1);
      expect(opacity(zoom, water("lake"))).toBe(LAKE_WASH.faint);
      expect(opacity(zoom, water("river"))).toBe(LAKE_WASH.faint);
    }
    expect(opacity(8, water("lake"))).toBeGreaterThan(LAKE_WASH.faint);
    expect(opacity(9, water("lake"))).toBe(LAKE_WASH.full);
    expect(opacity(9, water("ocean"))).toBe(1);
  });

  it("leaves ponds and intermittent water out at country zoom", () => {
    expect(opacity(6, water("pond"))).toBe(0);
    expect(opacity(6, water("lake", 1))).toBe(0);
    expect(opacity(9, water("pond"))).toBe(LAKE_WASH.full);
  });

  it("gives the loughs a faint shore of their own, and only close in", () => {
    const shore = layer("lake-shore");
    expect(shore.minzoom).toBe(INLAND_QUIET_UNTIL);
    expect(draws("lake-shore", water("lake"))).toBe(true);
    expect(draws("lake-shore", water("ocean"))).toBe(false);
  });
});
