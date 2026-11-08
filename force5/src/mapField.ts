/**
 * The map's one field: the colour laid over the sea and the land, chosen with
 * the lit chips in the map's dock (src/MapDock.tsx). At most one is on; with
 * none, the map is dark and plain with the shallows glowing blue round the
 * coast (the tidal depth). Wind is the coloured wind, Waves the wave height on
 * the sea, Weather the sky (grey cloud, yellow clear sky, black night) with
 * the rain over it.
 *
 * Apart from the map, so the choice is read and kept the same way wherever it
 * is shown: the finder's map and the full chart share it.
 */
import type { WindLayers } from "./windLayers";

/** A field the map can lay over the sea. */
export type FieldId = "wind" | "waves" | "weather";
/** The rider's choice: one field, or none. */
export type MapField = FieldId | "none";

/** Where the choice is kept, "none" too. */
export const FIELD_KEY = "wingfoil.map.field.v1";

/** Every field, in the order their chips stand. */
export const FIELDS: readonly FieldId[] = ["wind", "waves", "weather"];

/** A field's name on its chip and in the legend. */
export const FIELD_NAMES: Record<FieldId, string> = {
  wind: "Wind",
  waves: "Waves",
  weather: "Weather",
};

/** A first visit's map: no field, the shallows glowing. */
export const DEFAULT_FIELD: MapField = "none";

const isField = (value: unknown): value is MapField =>
  value === "none" || FIELDS.includes(value as FieldId);

/**
 * The rider's field from the store. A choice made with the chips is kept as
 * it was, "none" too. Before the chips there was the wind's Coloured wind
 * layer (`older`, as windLayers.ts reads it): a rider who had it on starts on
 * Wind, and everyone else on none.
 */
export function parseMapField(
  saved: string | null,
  older: WindLayers | null = null,
): MapField {
  if (isField(saved)) return saved;
  return older?.wash ? "wind" : DEFAULT_FIELD;
}

/**
 * The field after a chip is pressed: that chip's field, or none when it was
 * the one on already.
 */
export const pressField = (on: MapField, pressed: FieldId): MapField =>
  on === pressed ? "none" : pressed;

/** Which fields have something to draw them with. */
export interface FieldSources {
  /**
   * The wave height as frames for the map: whether the wave model's pointer
   * lists any, as the page finds once it is idle (src/useWaves.ts). With none
   * there is no Waves chip; the cards still have their waves.
   */
  waves: boolean;
}

/** The fields offered as chips: every one with a source, in their order. */
export const offeredFields = (sources: FieldSources): FieldId[] =>
  FIELDS.filter((field) => field !== "waves" || sources.waves);

/**
 * The field the map draws: the rider's, while it is offered; none while it is
 * not (Waves chosen where no wave frames are), the choice itself kept.
 */
export const shownField = (
  chosen: MapField,
  offered: readonly FieldId[],
): MapField =>
  chosen !== "none" && !offered.includes(chosen) ? "none" : chosen;

/**
 * The wind's two layers with the field: the coloured wind is the Wind field,
 * the particles the rider's own switch on the chart's rail.
 */
export const windWith = (field: MapField, particles: boolean): WindLayers => ({
  wash: field === "wind",
  particles,
});
