import { forwardRef, type CSSProperties } from "react";
import { X } from "lucide-react";
import {
  pillContent,
  pillHtml,
  type PillReading,
} from "../force5/src/pillContent";
import type { TideEvent } from "../force5/src/tides";
import { speedShort, type Units, type WaveUnits } from "../force5/src/units";
import type { Spot } from "../force5/src/weather";
import { Button } from "../ui/Button";
import { Link } from "../ui/Link";
import { StarGlyphs } from "../ui/StarGlyphs";
import { hourWords } from "./HourBar";
import type { PlaceHour } from "./ratings";
import { clock } from "./strip";

/**
 * The tide at an hour from a place's high and low waters: which way it is
 * going and the next turn ("Rising, high 14:20"), or null with none known.
 */
export function tideWords(
  tides: readonly TideEvent[],
  time: number,
): string | null {
  const next = tides.find((t) => Date.parse(t.time) > time);
  if (!next) return null;
  return `${next.kind === "high" ? "Rising" : "Falling"}, ${next.kind} ${clock(Date.parse(next.time))}`;
}

/** The wind's row: the arrow, the wind with its unit, and the gust after it. */
function windParts(reading: PillReading, units: Units) {
  const parts = pillContent(
    "none",
    { ...reading, sky: null, rain: null },
    units,
  );
  return parts && reading.gustKn !== null && reading.windKn !== null
    ? { ...parts, sup: `gust ${speedShort(reading.gustKn, units)}` }
    : parts;
}

/** One row's figures, drawn as the pills draw them (force5/src/pillContent.ts). */
function Figures({ html }: { html: string }) {
  return html ? (
    <span className="sp-fig" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span className="sp-none">Not known</span>
  );
}

/**
 * One spot at the hour the map shows, where no list stands beside the map:
 * its name, a link to its page, then its wind, waves, weather and tide, and
 * its stars. On the phone it is a small peek above the dock, opened by a tap
 * on a pill, whose second tap opens the spot (`peek`); on the full chart,
 * wider than a phone, a card beside the ring tapped, a small pointer at it
 * (`card`, placed by force5/src/cardPlace.ts), never over it. The figures are
 * the pills' own, so the card and the finder's pills read alike.
 */
const SpotPeek = forwardRef<
  HTMLDivElement,
  {
    spot: Spot;
    hour: PlaceHour | undefined;
    reading: PillReading;
    tides: readonly TideEvent[];
    /** The hour shown. */
    time: number | null;
    now: number;
    units: Units;
    waveUnits: WaveUnits;
    kind: "peek" | "card";
    /** The spot's own page. */
    href: string;
    onClose: () => void;
    /** Where a card stands, and its pointer's side and place. */
    style?: CSSProperties;
    side?: string;
  }
>(function SpotPeek(
  {
    spot,
    hour,
    reading,
    tides,
    time,
    now,
    units,
    waveUnits,
    kind,
    href,
    onClose,
    style,
    side,
  },
  ref,
) {
  const stars = hour?.rating && hour.daylight ? hour.rating : null;
  const tide = time === null ? null : tideWords(tides, time);
  return (
    <div
      ref={ref}
      className={`spot-peek is-${kind}`}
      role="group"
      aria-label={spot.name}
      data-spot-peek={spot.id}
      data-side={side}
      style={style}
    >
      <div className="sp-head">
        <div className="sp-name">
          <Link href={href} data-peek-open>
            {spot.name}
          </Link>
          {spot.county && <span>Co. {spot.county}</span>}
        </div>
        <Button
          variant="quiet"
          size="sm"
          icon
          aria-label="Close"
          onClick={onClose}
          data-peek-close
        >
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </div>
      <dl className="sp-rows">
        <dt>Wind</dt>
        <dd>
          <Figures html={pillHtml(windParts(reading, units))} />
        </dd>
        <dt>Waves</dt>
        <dd>
          {reading.inland ? (
            <span className="sp-none">None inland</span>
          ) : (
            <Figures
              html={pillHtml(pillContent("waves", reading, units, waveUnits))}
            />
          )}
        </dd>
        <dt>Weather</dt>
        <dd>
          <Figures html={pillHtml(pillContent("weather", reading, units))} />
        </dd>
        <dt>Tide</dt>
        <dd>
          {tide ? (
            <span>{tide}</span>
          ) : (
            <span className="sp-none">No tide here</span>
          )}
        </dd>
      </dl>
      <div className="sp-foot">
        {stars ? (
          <StarGlyphs
            stars={stars.stars}
            potential={stars.potential}
            size={12}
          />
        ) : (
          <span className="sp-none">
            {hour && !hour.daylight ? "Dark" : "No stars"}
          </span>
        )}
        {time !== null && <em>{hourWords(time, now)}</em>}
      </div>
    </div>
  );
});

export default SpotPeek;
