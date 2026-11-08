import { CloudSun, Waves, Wind } from "lucide-react";
import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Chip } from "../ui/Chip";
import {
  FIELD_NAMES,
  pressField,
  type FieldId,
  type MapField,
} from "../force5/src/mapField";
import MapScales from "./MapScales";

/** Each field's line icon on its chip: lines of wind, waves, the sun and a cloud. */
const ICONS: Record<FieldId, ReactNode> = {
  wind: <Wind size={16} strokeWidth={1.75} />,
  waves: <Waves size={16} strokeWidth={1.75} />,
  weather: <CloudSun size={16} strokeWidth={1.75} />,
};

/**
 * The map's dock, centred on its foot: what the map is coloured with, and
 * when. Its top row is the fields' lit chips (ui/Chip.tsx `lit`), at most one
 * on, and the legend at its right (src/MapScales.tsx); under them, where the
 * page has one, the day's hour bar (src/HourBar.tsx). With no field on, the
 * map is plain and the shallows glow round the coast; pressing the chip that
 * is on turns it off, back to that.
 *
 * The chips are one group with one stop on Tab: the arrows walk them, Home
 * and End go to the ends, Space or Enter presses, and Escape turns the field
 * off. On a phone the chips share the row's width and there is no legend.
 */
export default function MapDock({
  field,
  offered,
  onField,
  phone,
  where,
  onRoom,
  children,
}: {
  /** The field the map draws. */
  field: MapField;
  /** The fields with a chip: those with a source to draw them. */
  offered: readonly FieldId[];
  onField: (field: MapField) => void;
  phone: boolean;
  /** The page it is on: beside the list, or on the full chart. */
  where: "finder" | "chart";
  /**
   * The room it takes at the map's foot, from its top to the foot of the box
   * it stands in, as it changes: the map keeps what it fits clear of it.
   */
  onRoom?: (px: number) => void;
  /** The hour bar, where the page has one. */
  children?: ReactNode;
}) {
  const dock = useRef<HTMLDivElement>(null);
  const room = useRef(onRoom);
  room.current = onRoom;
  useLayoutEffect(() => {
    const el = dock.current;
    const holder = el?.offsetParent;
    if (!el || !holder) return;
    const measure = () =>
      room.current?.(
        Math.round(
          holder.getBoundingClientRect().bottom -
            el.getBoundingClientRect().top,
        ),
      );
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    watch.observe(holder);
    return () => {
      watch.disconnect();
      room.current?.(0);
    };
  }, [where]);
  const chips = useRef<HTMLDivElement>(null);
  // The chip Tab stops on: the last one the keys were on, else the one on,
  // else the first.
  const [current, setCurrent] = useState<FieldId | null>(null);
  const stop =
    current && offered.includes(current)
      ? current
      : field !== "none" && offered.includes(field)
        ? field
        : offered[0];
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [
      ...(chips.current?.querySelectorAll<HTMLButtonElement>(
        "[data-map-field]",
      ) ?? []),
    ];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    if (event.key === "Escape") {
      if (field === "none") return;
      event.preventDefault();
      // The map's own Escape (a spot let go) waits for the next one.
      event.stopPropagation();
      onField("none");
      return;
    }
    const last = buttons.length - 1;
    const to =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? at === last
          ? 0
          : at + 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? at === 0
            ? last
            : at - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (to === null) return;
    event.preventDefault();
    event.stopPropagation();
    buttons[to].focus();
  };
  return (
    <div
      ref={dock}
      className="map-dock"
      data-map-dock={where}
      data-field={field}
      role="group"
      aria-label="Map"
    >
      <div className="md-what">
        <div
          ref={chips}
          className="md-chips"
          role="group"
          aria-label="Map layer, one at a time"
          onKeyDown={keys}
        >
          {offered.map((id) => (
            <Chip
              key={id}
              variant="lit"
              glow={id}
              icon={ICONS[id]}
              pressed={field === id}
              tabIndex={id === stop ? 0 : -1}
              onFocus={() => setCurrent(id)}
              onClick={() => onField(pressField(field, id))}
              data-map-field={id}
            >
              {FIELD_NAMES[id]}
            </Chip>
          ))}
        </div>
        {!phone && <MapScales field={field} />}
      </div>
      {children}
    </div>
  );
}
