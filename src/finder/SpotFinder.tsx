/**
 * The spot finder, the home page at /: where is good for this rider, on one
 * day at a time. The spots as cards: each the place from above with the ride
 * rose on it, and the day hour by hour from first light to last as four bars,
 * the wind, the waves, the sky and the stars (src/finder/SpotCard.tsx).
 *
 * Over the cards, one row: ‹ Today ›, a heart and a filter button. The day
 * steps through today and the five days after it (src/finder/DaySteps.tsx). It
 * opens on today, and once today's rows are over (the hour after last light,
 * finder.ts `todayOver`) on tomorrow, at the hour it opens on. The filter
 * opens a sheet with the fewest stars a place is to have, the list's order
 * (the best first, the nearest, A to Z) and the model the stars are rated
 * from (the rider's own, as the spot page and Settings set it); a dot on the
 * button says the list is narrowed or reordered. A spot is found by name with
 * the top bar's search (ui/SpotSearch.tsx).
 *
 * The heart is what the list holds (2026-11-07). On, it is the rider's
 * favourites, wherever the map is, and pressing it fits the map beside the
 * list to them (src/App.tsx); a rider with favourites opens on it, and with
 * none it asks them to save one. Off, it is the spots in the map's view
 * (finder.ts `spotsInView`), read as the camera settles and never through a
 * pan: at most `MAX_CARDS` of them, with a quiet line after the list to zoom
 * in for the rest, which stand on the map as beads. With the best first,
 * how they are ordered goes by how wide the view is (finder.ts
 * `arrangementFor`): over about 180 km across the best spot in each county
 * leads, then the rest by their stars; down to about 120 km by their stars;
 * closer in, the nearest the map's middle first. An empty view says so. Until
 * the chart has a view, the list is `listFor`'s, so it is never empty on first
 * paint. Under the wide width there is no map to follow, and it is `listFor`'s
 * always: the spots round the rider, or without their place the spots nearest
 * where the chart was. The heart is in the address (`/?tab=favourites`,
 * finder.ts `TAB_PARAM`) once pressed, so it can be linked to, kept and
 * reloaded.
 *
 * The browser is never asked where the rider is unasked: a first visit is not
 * asked, and without their place the cards give no distances. The locate
 * button on the map beside the list asks it (`locate`), and turns the heart
 * off; with no map beside the list, "Use my location" in the filter sheet
 * does.
 *
 * The home page (since 26 October 2026). On a wide screen the chart stands
 * beside the list, drawn by src/App.tsx over the room the list leaves it
 * (`beside`); the list tells it which places it lists, which of their cards
 * the rider can see (`onInView`: a pill each on the map, the rest beads),
 * what each reads (`onReadings`), at which hour, which card is under the
 * pointer and where the rider is, and it tells the list what it shows
 * (`view`). Under that width the list is alone. The
 * cards keep one time between them, as a dashboard's charts do: the day
 * stepped to is the day on every card, and an hour picked on one card's bars
 * is picked on every card, its rose turned to it, and on the chart beside
 * them. The hour picked is App's (`picked`), so whatever else on the page
 * picks an hour shares it. Today, the hour they stand at is the hour now, the
 * nearest one (19:59 is 20:00, finder.ts `nearestHour`); any other day, the
 * hour it opens on. A card opens its spot's page; the chart is a button away
 * in the top bar. No legend: the stars and the wind's colours are the site's
 * own, said once on the Info page.
 *
 * A page of the map's bundle, drawn by src/App.tsx under the chart and
 * loaded as a chunk of its own. Its wind and its
 * stars are the chart's own rated hours, handed in; the places it lists are
 * handed back (`onWant`), so the chart reads their squares and rates them
 * first. Their sky, air, sea and tide it reads itself, as the dock reads a
 * place's (src/finder/useReadings.ts).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ViewBounds } from "../../force5/src/squares";
import type { Rider } from "../../force5/src/stars";
import type { Units } from "../../force5/src/units";
import type { Spot } from "../../force5/src/weather";
import { modelName, STARS_CHOICES } from "../../force5/src/lead";
import { isChartAddress } from "../../force5/src/siteNav";
import { Heart, MapPin, SlidersHorizontal } from "lucide-react";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Dialog } from "../../ui/Dialog";
import { Link } from "../../ui/Link";
import { Segmented } from "../../ui/Segmented";
import { tv } from "../../ui/tv";
import type { PlaceHour } from "../ratings";
import { irishDate, onDay, openingColumn, type StripColumn } from "../strip";
import {
  HOUR,
  LEAD_GAP,
  MAX_CARDS,
  arrangementFor,
  bestStars,
  cardDates,
  chooseCards,
  columnsByTime,
  dayOpening,
  dayRow,
  listFor,
  nearestHour,
  openingDay,
  openingScope,
  pickHour,
  scopeAddress,
  scopeInAddress,
  shownColumn,
  spotsInView,
  viewWidthKm,
  type Listed,
  type Order,
  type Scope,
} from "./finder";

export type { Scope };
import { DaySteps } from "./DaySteps";
import { HoverContext, hoverStore } from "./hover";
import { knownBefore, useRiderPlace } from "./location";
import { CardSkeleton, SpotCard, type SpotCardProps } from "./SpotCard";
import { NO_READINGS, useReadings, type Readings } from "./useReadings";
import {
  isStale,
  latestReading,
  pairStation,
  type WindStation,
} from "../../force5/src/windObs";

/** How long the list rests after a scroll before its cards in view are read. */
export const SCROLL_SETTLE_MS = 150;

/**
 * The cards at least half in the list's view, in the list's order: the cards
 * the rider can see, whose spots stand as pills on the map beside the list.
 */
export function cardsInView(list: HTMLElement): string[] {
  const view = list.getBoundingClientRect();
  const out: string[] = [];
  for (const card of list.querySelectorAll<HTMLElement>("[data-spot-card]")) {
    const r = card.getBoundingClientRect();
    const seen = Math.min(r.bottom, view.bottom) - Math.max(r.top, view.top);
    if (r.height > 0 && seen >= r.height / 2) out.push(card.dataset.spotCard!);
  }
  return out;
}

const styles = tv({
  slots: {
    // The list on the ground, the cards a shade off it; under the top bar
    // (src/App.tsx draws the bar, fixed at the top of the window).
    root: "flex flex-col bg-ground font-body text-ink antialiased",
    // Beside the chart the list scrolls in its own box under the bar. Alone,
    // it scrolls the page itself: a phone's browser then folds its bars
    // away as the reader scrolls, as it never does for a box of its own.
    split: "fixed inset-x-0 top-16 bottom-0 max-wide:top-14",
    page: "relative min-h-dvh pt-16 max-wide:pt-14",
    body: "flex min-h-0 flex-1",
    list: [
      "min-h-0 min-w-0 flex-1 px-3.5 pt-4 pb-10",
      "max-wide:px-3 max-wide:pt-3 max-wide:pb-20",
    ],
    scroller: "overflow-y-auto overscroll-contain",
    // Room at the foot of a phone's list.
    alone: "pb-24 max-wide:pb-24",
    // The list's head, one row: the day, the heart and the filter.
    head: "flex items-center gap-1.5 px-0.5 pb-3",
    filter: "relative shrink-0",
    // On the filter button: the list is narrowed or reordered.
    dot: "pointer-events-none absolute top-1 right-1 size-2 rounded-full bg-pen",
    // The filter sheet: a group a heading, its choices under it.
    filters: "grid gap-5",
    group: "m-0 grid gap-2 border-0 p-0",
    groupName: "m-0 p-0 font-body text-body font-medium text-ink-muted",
    filterRow: "flex flex-wrap items-center gap-2",
    // One card a row beside the chart; alone on a wide window, two, so a
    // card's hours never stretch across the screen.
    cards: "m-0 grid list-none grid-cols-1 items-start gap-2 p-0",
    cardsAlone: "rail:grid-cols-2",
    empty:
      "rounded-surface bg-sunken on-card px-4 py-3.5 text-prose leading-normal text-ink-2",
    // After the cards, when the map shows more than the list holds.
    more: "m-0 px-0.5 pt-3 text-body leading-normal text-ink-muted",
  },
});

/** The fewest stars a place is to have on the day shown, as chips. */
const FEWEST = [
  { value: 0, label: "Any stars" },
  { value: 3, label: "3+ stars" },
  { value: 4, label: "4+ stars" },
  { value: 5, label: "5 stars" },
] as const;

export interface FinderProps {
  spots: readonly Spot[];
  /** The chart's table of rated hours, and its version. */
  hours: ReadonlyMap<string, PlaceHour[]>;
  version: number;
  /** The chart's strip of columns: the hours are rated on it. */
  strip: readonly StripColumn[];
  /** The time now, as the chart keeps it. */
  now: number;
  starred: readonly string[];
  onToggleStar: (id: string) => void;
  rider: Rider;
  units: Units;
  reducedMotion: boolean;
  phone: boolean;
  /**
   * The places the finder lists, which it needs rated, and which list (the
   * tab), so the chart beside it is fitted again when the list is another:
   * none ("") until the list is known, while the places are read or the
   * browser is asked where the rider is.
   */
  onWant: (ids: readonly string[], list: string) => void;
  /** The chart stands beside the list, in the room it leaves on the right. */
  beside?: boolean;
  /**
   * What the chart beside the list shows, which Nearby lists; null until
   * there is a view to follow.
   */
  view?: ViewBounds | null;
  /** A mouse comes onto a place's card, or leaves it (null). */
  onHover?: (id: string | null) => void;
  /**
   * Beside the chart: the places whose cards are at least half in the list's
   * view, in its order, read again once a scroll has rested (never in the
   * middle of one) and whenever the cards change.
   */
  onInView?: (ids: readonly string[]) => void;
  /** Each listed place's sky, air and sea, as they are read (./useReadings.ts). */
  onReadings?: (readings: ReadonlyMap<string, Readings>) => void;
  /** The time every card shows, as it changes. */
  onShown?: (time: number) => void;
  /** Where the rider is, once their browser has said; else null. */
  onPlace?: (at: { lat: number; lon: number } | null) => void;
  /** The list is drawn: the chart beside it may be made. */
  onDrawn?: () => void;
  /** The model the stars are rated from, the rider's own, as on the spot page. */
  model: string;
  /** The rider picks another: theirs from now on, everywhere. */
  onModel: (id: string) => void;
  /**
   * The list is on the screen, not waiting under the full chart. The tab it
   * opens on is chosen, and the browser asked where the rider is, only once
   * it is.
   */
  onScreen?: boolean;
  /**
   * The weather stations and buoys with their readings (force5/src/windObs.ts),
   * or null until read: a card on today says what its nearest one measured.
   */
  stations?: readonly WindStation[] | null;
  /**
   * The hour picked on the cards' bars, or null for the hour the day stands
   * at; App keeps it, so the page shares one time (the hour bar on the map
   * beside the list picks it too). Kept here when not given.
   */
  picked?: number | null;
  /** An hour is picked on a card, or let go (null). */
  onPick?: (time: number | null) => void;
  /**
   * How many times the rider has pressed the locate button on the map: each
   * press asks the browser where they are, and turns the heart off.
   */
  locate?: number;
}

export default function SpotFinder(props: FinderProps) {
  const {
    spots,
    hours,
    version,
    strip,
    now,
    starred,
    onToggleStar,
    rider,
    units,
    reducedMotion,
    phone,
    onWant,
    beside = false,
    view = null,
    onHover,
    onInView,
    onReadings,
    onShown,
    onPlace,
    onDrawn,
    onScreen = true,
    model,
    onModel,
    locate = 0,
  } = props;
  const s = styles();
  // The heart: on or off as the address names it, else, once the list has
  // been on the screen, as it opened; until then as it would open: on with a
  // place saved, else off.
  const [kept, setScope] = useState<Scope | null>(() =>
    scopeInAddress(location.search),
  );
  const scope = kept ?? openingScope(starred);
  const heart = scope === "favourites";
  // Whether the address is to name the heart: it was pressed, or named.
  const [named, setNamed] = useState(() => kept !== null);
  // The browser is asked where the rider is only when they press the locate
  // button (or "Use my location" in the filter sheet, with no map beside the
  // list); a place kept from an earlier yes is read again quietly with the
  // heart off.
  const [asked, setAsked] = useState(false);
  const place = useRiderPlace(
    asked || locate > 0 || (onScreen && scope === "near" && knownBefore()),
    locate,
  );
  useEffect(() => {
    if (onScreen && kept === null) setScope(scope);
  }, [onScreen, kept, scope]);
  // The tab in the address, in place: the list's own address, never the
  // full chart's over it. Again as the list comes back on the screen, whose
  // address may have been written without it (the menu's Spot finder).
  useEffect(() => {
    if (!onScreen || !named) return;
    const url = window.location;
    if (url.pathname !== "/" || isChartAddress(url)) return;
    if (scopeInAddress(url.search) === scope) return;
    window.history.replaceState(
      window.history.state,
      "",
      scopeAddress(url.href, scope),
    );
  }, [onScreen, named, scope]);
  // Back or Forward to a list whose address names the other tab.
  useEffect(() => {
    const pop = () => {
      const tab = scopeInAddress(window.location.search);
      if (tab) setScope(tab);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => onDrawn?.(), []);
  // The day stepped to, drawn hour by hour on every card; null is the day the
  // finder opens on (today, or tomorrow once today is over).
  const [chosen, setChosen] = useState<string | null>(null);
  // The hour picked on that day's row, for every card; null is the hour the
  // day stands at (now, today). App's, where it is handed in.
  const [ownPick, setOwnPick] = useState<number | null>(null);
  const picked = props.picked !== undefined ? props.picked : ownPick;
  const setPicked = props.onPick ?? setOwnPick;
  // The time under a mouse, shared by every card without drawing them again.
  const [hover] = useState(hoverStore);

  // The list's order, and the fewest stars a place has on the day shown.
  const [order, setOrder] = useState<Order>("best");
  const [fewest, setFewest] = useState(0);
  // The filter sheet.
  const [filtering, setFiltering] = useState(false);

  const chooseScope = (next: Scope) => {
    setScope(next);
    setNamed(true);
  };
  // The locate button pressed: the spots round the rider, so the heart off.
  useEffect(() => {
    if (locate > 0) chooseScope("near");
  }, [locate]);

  // Where "near you" and the distances are measured from: the rider's
  // place once the browser has said. Without it, the places nearest where
  // the chart was last centred, or the middle of Ireland, with no distances;
  // and none while the browser is first asked.
  const known = place.source === "rider";
  // A filter at work on the tab's list (an order counts, a nearest first
  // without the rider's place being the best first): Clear takes the list
  // back to the whole of it.
  const ordered = order === "near" && !known ? "best" : order;
  const narrowing = fewest > 0 || ordered !== "best";
  const clearNarrowing = () => {
    setFewest(0);
    setOrder("best");
  };
  const waiting = scope === "near" && place.asking;
  // The places themselves not read yet (src/App.tsx reads them with the
  // forecast's first manifest): the shapes of the cards to come, not the
  // empty list's words.
  const placesDue =
    spots.length === 0 && !waiting && (scope === "near" || starred.length > 0);
  // Beside the chart, the heart off is what the chart shows; before it has a
  // view, and anywhere else, the list as ever.
  const following = beside && scope === "near" && view !== null && !waiting;
  // How the spots in view are ordered with the best first, by how wide the
  // view is; and how far apart a regional list's leads are.
  const widthKm = following ? viewWidthKm(view!) : 0;
  const arrange = following ? arrangementFor(widthKm) : "best";
  const leadGap = widthKm * LEAD_GAP;
  const listed = useMemo(
    () =>
      waiting
        ? []
        : following
          ? spotsInView(spots, view!, known ? place.at : null)
          : listFor(scope, spots, starred, place.at, known),
    [scope, spots, starred, place.at, known, waiting, following, view],
  );
  const placeLat = known ? place.at.lat : null;
  const placeLon = known ? place.at.lon : null;
  useEffect(
    () =>
      onPlace?.(
        placeLat === null || placeLon === null
          ? null
          : { lat: placeLat, lon: placeLon },
      ),
    [placeLat, placeLon],
  );

  // Every half hour: the date, and the hour now as `nearestHour` says it.
  const halfHour = Math.floor(now / (HOUR / 2));
  const dates = useMemo(() => cardDates(now), [halfHour]);
  const allListed = useMemo(() => listed.map((l) => l.spot), [listed]);
  // The day the finder opens on: today, or tomorrow once today's rows are
  // over at every place listed; every place there is while the list follows
  // the map, so that a pan west at dusk does not step the day back.
  const opensOn = useMemo(
    () => openingDay(dates, following ? spots : allListed, now),
    [dates, following, spots, allListed, halfHour],
  );
  // A day stepped to yesterday that is gone now is the opening day again.
  const day = chosen !== null && dates.includes(chosen) ? chosen : opensOn;
  const isToday = day === dates[0];
  // An hour picked on another day is not one of this day's to show.
  const pick = picked !== null && irishDate(picked) === day ? picked : null;
  const chooseDay = (date: string) => {
    setChosen(date === opensOn ? null : date);
    setPicked(null);
  };
  const byTime = useMemo(() => columnsByTime(strip), [strip]);
  // The list's places, the best on the day first, then in the order asked;
  // only the first `MAX_CARDS` while the list follows the map, arranged by
  // how wide its view is, and how many there were.
  const { cards: ranked, total } = useMemo(() => {
    const rated: Listed[] = listed.map(({ spot, km }) => ({
      spot,
      km,
      best: bestStars(hours.get(spot.id), strip, [day], now),
    }));
    // Nearest first means nothing without the rider's place.
    const by = order === "near" && !known ? "best" : order;
    return chooseCards(
      rated,
      by,
      fewest,
      following ? MAX_CARDS : Infinity,
      arrange,
      leadGap,
    );
  }, [
    arrange,
    leadGap,
    listed,
    order,
    known,
    fewest,
    following,
    hours,
    version,
    strip,
    day,
    halfHour,
  ]);
  // The places the list asks to be rated, and draws as pills: following the
  // map, those with a card; else every place on the list, as the fit wants.
  // In a steady order, so that a new order of the same places asks nothing.
  const wanted = (following ? ranked : listed).map((l) => l.spot.id);
  const wantKey = (following ? [...wanted].sort() : wanted).join(",");
  // Which list, once the list is the list.
  const settled = !waiting && !placesDue;
  const listKey = settled ? scope : "";
  useEffect(() => onWant(wanted, listKey), [wantKey, listKey]);
  // The places with a card: their days, their readings and their stations.
  const listedSpots = useMemo(
    () => (following ? ranked.map((l) => l.spot) : allListed),
    [following ? wantKey : allListed],
  );

  const axis = useMemo(() => strip.map((c) => c.validTime), [strip]);
  const readings = useReadings(listedSpots, axis);
  useEffect(() => onReadings?.(readings), [readings]);
  // Each listed place's nearest station, and its latest reading while it is
  // fresh enough to be the wind now: a card on today says it.
  const stations = props.stations ?? null;
  const measuredNow = useMemo(() => {
    const out = new Map<string, NonNullable<SpotCardProps["measured"]>>();
    if (!stations) return out;
    for (const spot of listedSpots) {
      const paired = pairStation(spot, stations);
      const reading = paired ? latestReading(paired.station, now) : null;
      if (paired && reading && !isStale(reading, now))
        out.set(spot.id, { paired, reading });
    }
    return out;
  }, [stations, listedSpots, now]);

  // The day's row, at each place's own light.
  const rows = useMemo(
    () =>
      new Map(
        listedSpots.map((spot) => [
          spot.id,
          dayRow(strip, spot, day, now, byTime),
        ]),
      ),
    [listedSpots, strip, byTime, day, halfHour],
  );

  // Where the day stands with no hour picked: now, today, as the chart
  // would open; any other day, the hour it opens on.
  const opening = isToday
    ? strip.length
      ? openingColumn(strip, now)
      : null
    : dayOpening(strip, day, now);
  const roseAt = shownColumn(strip, pick, opening, byTime);
  const noon = Date.parse(`${day}T12:00:00Z`);
  const standing = isToday
    ? nearestHour(now)
    : opening === null
      ? noon
      : strip[opening].time;
  const shown = pick ?? standing;
  useEffect(() => onShown?.(shown), [shown]);
  const headId = "finder-heading";
  // "today", "tomorrow", "on Thursday": the day shown, in a sentence.
  const onTheDay = onDay(noon, now);
  // With no map beside the list, there is no locate button: the sheet asks.
  const canAsk =
    !beside &&
    scope === "near" &&
    !known &&
    !waiting &&
    !place.refused &&
    place.locates;
  const grid = s.cards({ class: beside ? undefined : s.cardsAlone() });

  // The cards the rider can see beside the chart: read as the cards change,
  // and once a scroll or a resize has rested, never in the middle of one.
  const listRef = useRef<HTMLElement>(null);
  const seenKey = useRef<string | null>(null);
  const cardsKey = ranked.map((l) => l.spot.id).join(",");
  useEffect(() => {
    const list = listRef.current;
    if (!beside || !onInView || !list) return;
    const read = () => {
      const ids = cardsInView(list);
      const key = ids.join(",");
      if (key === seenKey.current) return;
      seenKey.current = key;
      onInView(ids);
    };
    let timer = 0;
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(read, SCROLL_SETTLE_MS);
    };
    read();
    list.addEventListener("scroll", later, { passive: true });
    // The list's box, and its cards as their rows come in and grow.
    const resized = new ResizeObserver(later);
    resized.observe(list);
    const cards = list.querySelector("[data-finder-cards]");
    if (cards) resized.observe(cards);
    return () => {
      window.clearTimeout(timer);
      list.removeEventListener("scroll", later);
      resized.disconnect();
    };
  }, [beside, cardsKey, placesDue]);

  return (
    <div
      className={s.root({ class: beside ? s.split() : s.page() })}
      data-spot-finder
      data-scope={scope}
      data-beside-chart={beside || undefined}
    >
      <div className={s.body()}>
        <section
          ref={listRef}
          className={s.list({ class: beside ? s.scroller() : s.alone() })}
          aria-labelledby={headId}
          aria-busy={waiting || placesDue || undefined}
          data-finder-list
        >
          <h1 className="sr-only" id={headId} data-finder-heading>
            {heart
              ? "Favourites"
              : following
                ? "Spots in view"
                : "Spots near you"}
          </h1>
          <div className={s.head()}>
            <DaySteps dates={dates} day={day} now={now} onDay={chooseDay} />
            <Button
              variant="quiet"
              icon
              pressed={heart}
              aria-label="Favourites"
              title={
                heart ? "Show the spots on the map" : "Show your favourites"
              }
              onClick={() => chooseScope(heart ? "near" : "favourites")}
              data-finder-heart
            >
              <Heart
                size={18}
                strokeWidth={1.75}
                fill={heart ? "currentColor" : "none"}
                aria-hidden="true"
              />
            </Button>
            <Button
              variant="quiet"
              icon
              aria-label={narrowing ? "Filter, on" : "Filter"}
              aria-haspopup="dialog"
              className={s.filter()}
              onClick={() => setFiltering(true)}
              data-finder-filter
              data-narrowed={narrowing || undefined}
            >
              <SlidersHorizontal
                size={18}
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {narrowing && <i className={s.dot()} aria-hidden="true" />}
            </Button>
          </div>
          <Dialog
            open={filtering}
            title="Filter"
            onClose={() => setFiltering(false)}
            actions={
              <>
                {narrowing && (
                  <Button
                    variant="quiet"
                    onClick={clearNarrowing}
                    data-finder-clear
                  >
                    Clear
                  </Button>
                )}
                <Button variant="primary" onClick={() => setFiltering(false)}>
                  Done
                </Button>
              </>
            }
          >
            <div className={s.filters()} data-finder-filters>
              <fieldset className={s.group()}>
                <legend className={s.groupName()}>Stars {onTheDay}</legend>
                <div className={s.filterRow()}>
                  {FEWEST.map((choice) => (
                    <Chip
                      key={choice.value}
                      pressed={fewest === choice.value}
                      onClick={() => setFewest(choice.value)}
                      data-finder-stars={choice.value}
                    >
                      {choice.label}
                    </Chip>
                  ))}
                </div>
              </fieldset>
              <div className={s.group()}>
                <p className={s.groupName()}>Sort</p>
                <Segmented
                  aria-label="Order"
                  options={[
                    { value: "best", label: "Best first" },
                    ...(known
                      ? [{ value: "near" as const, label: "Nearest" }]
                      : []),
                    { value: "name", label: "A to Z" },
                  ]}
                  value={ordered}
                  onChange={setOrder}
                />
              </div>
              <div className={s.group()}>
                <p className={s.groupName()}>Model for the stars</p>
                <Segmented
                  aria-label="Model for the stars"
                  options={STARS_CHOICES.map((id) => ({
                    value: id,
                    label: modelName(id),
                  }))}
                  value={model}
                  onChange={onModel}
                />
              </div>
              {canAsk && (
                <div className={s.group()}>
                  <p className={s.groupName()}>Location</p>
                  <div className={s.filterRow()}>
                    <Button
                      size="sm"
                      onClick={() => {
                        setAsked(true);
                        setFiltering(false);
                      }}
                    >
                      <MapPin size={16} strokeWidth={1.75} aria-hidden="true" />
                      Use my location
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Dialog>
          {placesDue ? (
            <div className={grid} data-finder-loading>
              {Array.from(
                {
                  length: Math.min(
                    4,
                    scope === "near" ? 4 : Math.max(1, starred.length),
                  ),
                },
                (_, k) => (
                  <CardSkeleton
                    key={k}
                    words={k === 0 ? "Loading the spots…" : undefined}
                  />
                ),
              )}
            </div>
          ) : ranked.length ? (
            <HoverContext.Provider value={hover}>
              <ul className={grid} data-finder-cards data-day={day}>
                {ranked.map((item) => {
                  return (
                    <li
                      key={item.spot.id}
                      className="min-w-0"
                      onMouseEnter={
                        onHover ? () => onHover(item.spot.id) : undefined
                      }
                      onMouseLeave={onHover ? () => onHover(null) : undefined}
                    >
                      <SpotCard
                        spot={item.spot}
                        km={item.km}
                        row={hours.get(item.spot.id)}
                        strip={strip}
                        day={rows.get(item.spot.id) ?? null}
                        isToday={isToday}
                        measured={
                          isToday
                            ? (measuredNow.get(item.spot.id) ?? null)
                            : null
                        }
                        readings={readings.get(item.spot.id) ?? NO_READINGS}
                        picked={pick}
                        shown={shown}
                        roseAt={roseAt}
                        now={now}
                        rider={rider}
                        units={units}
                        starred={starred.includes(item.spot.id)}
                        phone={phone}
                        reducedMotion={reducedMotion}
                        onToggleStar={() => onToggleStar(item.spot.id)}
                        onPick={(time) => setPicked(pickHour(time, standing))}
                        best={item.best}
                      />
                    </li>
                  );
                })}
              </ul>
              {total > ranked.length && (
                <p className={s.more()} data-finder-more>
                  {total} spots in view,{" "}
                  {arrange === "centre"
                    ? `the ${ranked.length} nearest the middle here`
                    : `the best ${ranked.length} here`}
                  . Zoom in for the rest.
                </p>
              )}
            </HoverContext.Provider>
          ) : (
            <p className={s.empty()} data-finder-empty>
              {listed.length && fewest > 0 ? (
                fewest === 5 ? (
                  `No spot on this list has 5 stars ${onTheDay}.`
                ) : (
                  `No spot on this list has ${fewest} stars or more ${onTheDay}.`
                )
              ) : heart ? (
                <>
                  No favourites yet. Press the heart on a spot&rsquo;s card to
                  save it here, or find one by name with the search at the top.
                  See the{" "}
                  <Link
                    href={scopeAddress(window.location.href, "near")}
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey)
                        return;
                      event.preventDefault();
                      chooseScope("near");
                    }}
                  >
                    {beside ? "spots on the map" : "spots nearby"}
                  </Link>
                  , or <Link href="/spot">browse every spot</Link>.
                </>
              ) : waiting ? (
                "Finding spots nearby…"
              ) : following ? (
                "No spots in this part of the map. Zoom out or move the map."
              ) : (
                "No spots within 30 km of you."
              )}
            </p>
          )}
        </section>
        {/* The room the chart stands in beside the list (src/App.tsx). */}
        {beside && <div className="finder-side" aria-hidden="true" />}
      </div>
    </div>
  );
}
