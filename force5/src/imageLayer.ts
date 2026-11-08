// A field drawn on the chart as one picture: an image source and a raster
// layer of the same id, for the sky (skyLayer.ts) and the waves
// (waveLayer.ts). Loaded with them, the first time either has anything to
// draw.
//
// The picture lies over the chart's fills (the land, the sea, the depth
// tints, a satellite picture, the coloured wind) and under its ink: the
// relief's hachures, the rivers, the coast, the contours and every name, and
// the lights, which are drawn over the map. So a field never hides the shore.
import type { ImageSource, Map as MapLibreMap } from "maplibre-gl";
import type { GridImage } from "./gridImage";

/** What a field lies under: the first of these the chart has. */
const UNDER = ["relief", "rivers"];

const settling = new WeakMap<MapLibreMap, Set<string>>();
let canvas: HTMLCanvasElement | null = null;

const under = (map: MapLibreMap) => UNDER.find((id) => map.getLayer(id));

/** The layer just over a field's: what it lies under, or "" for none. */
export function layerOver(map: MapLibreMap, id: string) {
  const order = map.getLayersOrder();
  return order[order.indexOf(id) + 1] ?? "";
}

/**
 * Keep a field straight under the ink. Layers added later under the same one
 * (a satellite picture, the coloured wind) would otherwise land over it.
 */
function settle(map: MapLibreMap, id: string) {
  const below = under(map);
  if (!below || !map.getLayer(id)) return;
  // Moving a layer is itself a style change: only when it is out of place.
  if (layerOver(map, id) !== below) map.moveLayer(id, below);
}

/** Lay a picture on the chart as the field `id`, made the first time. */
export function paintImage(map: MapLibreMap, id: string, image: GridImage) {
  canvas ??= document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d")!;
  const pixels = context.createImageData(image.width, image.height);
  pixels.data.set(image.data);
  context.putImageData(pixels, 0, 0);
  const url = canvas.toDataURL();
  const source = map.getSource(id) as ImageSource | undefined;
  if (source) source.updateImage({ url, coordinates: image.coordinates });
  else
    map.addSource(id, { type: "image", url, coordinates: image.coordinates });
  if (!map.getLayer(id))
    map.addLayer(
      {
        id,
        type: "raster",
        source: id,
        paint: {
          "raster-opacity": 1,
          "raster-fade-duration": 0,
          "raster-resampling": "linear",
        },
      },
      under(map),
    );
}

/** Show the field `id`, already painted, and keep it under the ink. */
export function showImage(map: MapLibreMap, id: string) {
  map.setLayoutProperty(id, "visibility", "visible");
  let ids = settling.get(map);
  if (!ids) {
    const kept = new Set<string>();
    settling.set(map, kept);
    map.on("styledata", () => kept.forEach((each) => settle(map, each)));
    ids = kept;
  }
  ids.add(id);
  settle(map, id);
}

/** Hide the field `id`, kept for the next time it is shown. */
export function hideImage(map: MapLibreMap, id: string) {
  if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
}
