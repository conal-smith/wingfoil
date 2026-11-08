// The Weather field on the chart: the sky at the hour shown, coloured by its
// cloud and darkened where the sun is down, and the rain over it
// (force5/src/sky.ts), as one picture under the chart's ink
// (force5/src/imageLayer.ts). Loaded by WindMap.tsx the first time the field
// has anything to draw, so none of it is in the page a rider who wants only
// the wind loads.
import type { Map as MapLibreMap } from "maplibre-gl";
import { hideImage, layerOver, paintImage, showImage } from "./imageLayer";
import type { RainView } from "./rain";
import { skyImage, skyPalette } from "./sky";

export const SKY_LAYER = "sky";

const painted = new WeakMap<MapLibreMap, string>();

/**
 * Says on the map's box what it draws and what over, for the page's own
 * tests: the rain's hours, and whether the sky under it has its cloud.
 */
function mark(map: MapLibreMap, view: RainView | null) {
  const box = map.getContainer();
  if (view) {
    box.dataset.rain = view.key;
    box.dataset.rainFrom = new Date(view.from).toISOString();
    box.dataset.rainTo = new Date(view.to).toISOString();
    box.dataset.rainUnder = layerOver(map, SKY_LAYER);
    box.dataset.sky = view.cloud ? "cloud" : "rain-only";
  } else {
    delete box.dataset.rain;
    delete box.dataset.rainFrom;
    delete box.dataset.rainTo;
    delete box.dataset.rainUnder;
    delete box.dataset.sky;
  }
}

export function drawSky(map: MapLibreMap, view: RainView) {
  if (painted.get(map) !== view.key || !map.getLayer(SKY_LAYER)) {
    // The colours read as the picture is made, so it is in the theme's.
    const style = getComputedStyle(map.getContainer());
    paintImage(
      map,
      SKY_LAYER,
      skyImage(
        view.grid,
        view.cloud,
        view.rates,
        view.time,
        skyPalette((token) => style.getPropertyValue(token)),
      ),
    );
    painted.set(map, view.key);
  }
  showImage(map, SKY_LAYER);
  mark(map, view);
}

export function hideSky(map: MapLibreMap) {
  hideImage(map, SKY_LAYER);
  mark(map, null);
}
