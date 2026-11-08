// The Waves field on the chart: the wave height on the sea at the hour shown
// (force5/src/waveField.ts), as one picture under the chart's ink
// (force5/src/imageLayer.ts). Loaded by WindMap.tsx the first time the field
// has anything to draw.
import type { Map as MapLibreMap } from "maplibre-gl";
import { hideImage, paintImage, showImage } from "./imageLayer";
import { WAVE_STOPS } from "./fieldStops";
import { waveImage, waveRamp, type WaveView } from "./waveField";

export const WAVE_LAYER = "waves";

const painted = new WeakMap<MapLibreMap, string>();

/** Says on the map's box which frame it draws, for the page's own tests. */
function mark(map: MapLibreMap, view: WaveView | null) {
  const box = map.getContainer();
  if (view) box.dataset.waves = new Date(view.time).toISOString();
  else delete box.dataset.waves;
}

/**
 * Draw the frame, painted again only when it or the theme's colours have
 * changed: the wave height's ramp is re-themed, so a change of theme draws
 * it afresh in the new one.
 */
export function drawWaves(map: MapLibreMap, view: WaveView) {
  const style = getComputedStyle(map.getContainer());
  const read = (token: string) => style.getPropertyValue(token);
  const key = [view.key, ...WAVE_STOPS.map(({ token }) => read(token))].join(
    "|",
  );
  if (painted.get(map) !== key || !map.getLayer(WAVE_LAYER)) {
    paintImage(
      map,
      WAVE_LAYER,
      waveImage(view.grid, view.heights, waveRamp(read)),
    );
    painted.set(map, key);
  }
  showImage(map, WAVE_LAYER);
  mark(map, view);
}

export function hideWaves(map: MapLibreMap) {
  hideImage(map, WAVE_LAYER);
  mark(map, null);
}
