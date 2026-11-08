import {
  barName,
  expect,
  siteNav,
  siteRow,
  SITE_ROW_TEXTS,
  SPOTS_KEY,
  test,
  type Page,
} from "./fixtures";
import { SAMPLE_CLOCK } from "./columns";

/**
 * The spot finder, the home page (src/finder): the rider's places as cards,
 * the best on the day shown first, each with its picture and rose, and the
 * day hour by hour from first light to last; ‹ Today › steps through the six
 * days, and after dark it opens on tomorrow. No timeline, not tied to the
 * chart's time; on a wide screen the chart stands beside it
 * (e2e/home-chart.spec.ts). The heart at the list's head on, the rider's
 * favourites, once they have saved a place; else off, the spots in view, or
 * with no map beside the list every place near the rider.
 */

const DUBLIN = { latitude: 53.35, longitude: -6.26 };
/** The middle of Ireland, with no spot within 30 km. */
const ATHLONE = { latitude: 53.42, longitude: -7.94 };
const LOCATION_KEY = "wingfoil.finder.location.v1";

/**
 * A browser that asks where the rider is and has not been answered: the
 * answer comes when the test calls `window.answerWhere()`.
 */
const unanswered = (page: Page, at: { latitude: number; longitude: number }) =>
  page.addInitScript((at) => {
    const waiting: PositionCallback[] = [];
    const w = window as unknown as { answerWhere: () => void };
    w.answerWhere = () =>
      waiting.splice(0).forEach((ok) =>
        ok({
          coords: { ...at, accuracy: 10 },
          timestamp: Date.now(),
        } as unknown as GeolocationPosition),
      );
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (ok: PositionCallback) => waiting.push(ok),
        watchPosition: () => 0,
        clearWatch: () => {},
      },
    });
  }, at);

/**
 * Half past two in the afternoon, Irish time, on the sample's day: inside
 * HARMONIE's run, with the afternoon's light ahead. The suite's own clock
 * (`SAMPLE_CLOCK`) is that evening, after last light, when today's row is
 * all hours gone and the finder opens on tomorrow.
 */
const AFTERNOON = new Date(SAMPLE_CLOCK.getTime() - 7.5 * 3600000);

/** Star these places before the page's own scripts run. */
const star = (page: Page, ids: string[]) =>
  page.addInitScript(
    ([key, ids]) => {
      if (localStorage.getItem(key) === null)
        localStorage.setItem(key, JSON.stringify({ starred: ids, visits: {} }));
    },
    [SPOTS_KEY, ids] as const,
  );

const finder = (page: Page) => page.locator("[data-spot-finder]");
/** The day the finder shows, and its arrows (src/finder/DaySteps.tsx). */
const days = (page: Page) => page.getByRole("group", { name: "Day" });
const shownDay = (page: Page) => page.locator("[data-finder-day]");
const earlier = (page: Page) =>
  days(page).getByRole("button", { name: "Previous day" });
const later = (page: Page) =>
  days(page).getByRole("button", { name: "Next day" });
/**
 * The hour the chart's pills beside the list stand at, as they say it to a
 * screen reader ("Brandon Bay, Kerry: 13:00 3 stars, …"); null before any.
 */
const mapHour = (page: Page) =>
  page.locator(".spot-marker.lt-pilled").evaluateAll((els) => {
    for (const el of els) {
      const hour = /: (\d\d:\d\d) /.exec(el.getAttribute("aria-label") ?? "");
      if (hour) return hour[1];
    }
    return null;
  });
/** The Irish date of a moment, and of the day after it. */
const irishDate = (time: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(
    new Date(time),
  );
const SAMPLE_DAY = irishDate(SAMPLE_CLOCK.getTime());
const SAMPLE_TOMORROW = irishDate(SAMPLE_CLOCK.getTime() + 24 * 3600000);
/** Every card's bars are this day's. */
const barsOn = (page: Page) =>
  page
    .locator("[data-day-bars]")
    .evaluateAll((els) => [
      ...new Set(els.map((el) => el.getAttribute("data-day-bars"))),
    ]);
/**
 * The way the browser is asked where the rider is: the locate button on the
 * map beside the list, or with no map beside it "Use my location" in the
 * filter sheet.
 */
const useMyLocation = async (page: Page) => {
  if (page.viewportSize()!.width >= 1100) {
    await page
      .getByRole("region", { name: "The chart, at the spots on the list" })
      .getByRole("button", { name: "Use my location" })
      .click();
    return;
  }
  // Under that width the map has it too, over the dock; the list follows.
  await page
    .getByRole("group", { name: "Map or list" })
    .getByRole("button", { name: "Map" })
    .click();
  await page
    .locator("[data-narrow-foot]")
    .getByRole("button", { name: "Use my location" })
    .click();
  await toList(page);
};
/** Under the width for the list beside the map: the list, from the map. */
const toList = async (page: Page) => {
  const list = page
    .getByRole("group", { name: "Map or list" })
    .getByRole("button", { name: "List" });
  if ((await list.getAttribute("aria-pressed")) !== "true") await list.click();
  await expect(list).toHaveAttribute("aria-pressed", "true");
};
const cards = (page: Page) => page.locator("[data-spot-card]");
/** The heart at the list's head: on, the favourites; off, the spots in view. */
const heart = (page: Page) =>
  page
    .locator("[data-finder-list]")
    .getByRole("button", { name: "Favourites" });
/** Turn the heart on or off, from whichever it is. */
const setHeart = async (page: Page, on: boolean) => {
  if ((await heart(page).getAttribute("aria-pressed")) !== String(on))
    await heart(page).click();
  await expect(heart(page)).toHaveAttribute("aria-pressed", String(on));
};
/** The top bar's search, a combobox (ui/SpotSearch.tsx). */
const search = (page: Page) =>
  page.getByRole("combobox", { name: "Search spots" });
/** The list's filters, in view under its heading. */
const filters = (page: Page) => page.locator("[data-finder-filters]");
/** The filter button, and the sheet it opens. */
const openFilters = async (page: Page) => {
  await page.locator("[data-finder-filter]").click();
  await expect(page.getByRole("dialog", { name: "Filter" })).toBeVisible();
};

/** The finder up in the afternoon, its places rated. */
async function openFinder(page: Page, path = "/") {
  await page.clock.setFixedTime(AFTERNOON);
  await page.goto(path);
  // Under the width for the map beside the list the map comes first: the
  // list is a switch away.
  if (page.viewportSize()!.width < 1100) await toList(page);
  await expect(finder(page)).toBeVisible({ timeout: 30000 });
}

/** Wait until every card is rated, and say each one's best. */
async function rated(page: Page) {
  await expect
    .poll(
      async () =>
        (await cards(page).evaluateAll((els) =>
          els.every((el) => Number(el.getAttribute("data-best")) >= 0),
        )) && (await cards(page).count()) > 0,
      { timeout: 30000 },
    )
    .toBe(true);
  return cards(page).evaluateAll((els) =>
    els.map((el) => ({
      id: el.getAttribute("data-spot-card")!,
      best: Number(el.getAttribute("data-best")),
      day: Number(el.getAttribute("data-best-day") ?? 99),
    })),
  );
}

/** The best first, the soonest among equals. */
const inOrder = (list: { best: number; day: number }[]) =>
  list.every(
    (x, i) =>
      i === 0 ||
      list[i - 1].best > x.best ||
      (list[i - 1].best === x.best && list[i - 1].day <= x.day),
  );

test.describe("on a desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("opens with the heart on, the favourites the best first, one card a row in a narrow list beside a plain chart", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await star(page, ["brandon", "dollymount", "keel", "tramore"]);
    await openFinder(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(heart(page)).toHaveAttribute("aria-pressed", "true");
    await expect(cards(page)).toHaveCount(4);
    expect(inOrder(await rated(page))).toBe(true);
    // One column, a narrow list (400px), the chart taking the rest.
    const [a, b] = [
      (await cards(page).nth(0).boundingBox())!,
      (await cards(page).nth(1).boundingBox())!,
    ];
    expect(b.x).toBe(a.x);
    expect(b.y).toBeGreaterThan(a.y + a.height);
    expect(a.width).toBeLessThanOrEqual(420);
    const chart = (await page
      .getByRole("region", { name: "The chart, at the spots on the list" })
      .boundingBox())!;
    expect(chart.x).toBeGreaterThan(a.x + a.width);
    expect(chart.width).toBeGreaterThan(900);
    // A card: its picture, its name and county, and the day's wind, waves,
    // sky and stars as four bars, in that order, with the hour shown ticked
    // on them.
    const brandon = cards(page).filter({ hasText: "Brandon Bay" });
    await expect(brandon).toContainText("Co. Kerry");
    const rows = brandon.locator("[data-bar]");
    await expect(rows).toHaveCount(4);
    expect(
      await rows.evaluateAll((els) =>
        els.map((el) => el.getAttribute("data-bar")),
      ),
    ).toEqual(["wind", "waves", "sky", "stars"]);
    for (const name of ["Wind", "Waves", "Sky", "Stars"])
      await expect(
        brandon.locator("[data-day-bars]").getByText(name, { exact: true }),
      ).toBeVisible();
    await expect(brandon.locator("[data-shown-tick]")).toHaveCount(4);
    // The sky's temperature every three hours.
    await expect(brandon.locator('[data-bar="sky"] b').first()).toHaveText(
      /^-?\d+°$/,
    );
    expect(errors).toEqual([]);
  });

  test("a press on a card's bars picks that hour on every card", async ({
    page,
  }) => {
    await star(page, ["brandon", "keel"]);
    await openFinder(page);
    await rated(page);
    const tick = (card: number) =>
      cards(page)
        .nth(card)
        .locator('[data-bar="stars"] [data-shown-tick]')
        .getAttribute("style");
    const before = [await tick(0), await tick(1)];
    const bar = cards(page).nth(0).locator('[data-bar="wind"]');
    const box = (await bar.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.2, box.y + box.height / 2);
    await expect(page.locator("[data-picked-hour]")).toHaveCount(2);
    await expect.poll(() => tick(0)).not.toBe(before[0]);
    expect(await tick(1)).toBe(await tick(0));
  });

  test("the day steps through today and the five days after it, on every card and the chart", async ({
    page,
  }) => {
    await star(page, ["brandon", "keel", "dollymount"]);
    await openFinder(page);
    await rated(page);
    // In the afternoon it opens on today, the hour now ticked on each card.
    await expect(shownDay(page)).toHaveAttribute("data-finder-day", SAMPLE_DAY);
    await expect(shownDay(page)).toContainText("Today");
    await expect(earlier(page)).toBeDisabled();
    await expect.poll(() => mapHour(page)).toMatch(/^\d\d:00$/);
    expect(await barsOn(page)).toEqual([SAMPLE_DAY]);
    // One on: tomorrow, on every card, at the hour it opens on, which the
    // chart's pills stand at too.
    await later(page).click();
    await expect(shownDay(page)).toHaveAttribute(
      "data-finder-day",
      SAMPLE_TOMORROW,
    );
    await expect(shownDay(page)).toContainText("Tomorrow");
    await expect.poll(() => barsOn(page)).toEqual([SAMPLE_TOMORROW]);
    const opening = await page
      .locator("[data-rose-hour]")
      .first()
      .textContent();
    expect(opening).toMatch(/^\d\d:00$/);
    await expect.poll(() => mapHour(page)).toBe(opening);
    await expect(cards(page).locator("[data-shown-tick]")).toHaveCount(12);
    await expect(earlier(page)).toBeEnabled();
    // A press on the bars picks an hour of tomorrow's, on every card.
    const bar = cards(page).nth(0).locator('[data-bar="wind"]');
    const box = (await bar.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.15, box.y + box.height / 2);
    await expect(page.locator("[data-picked-hour]")).toHaveCount(3);
    await expect.poll(() => mapHour(page)).toMatch(/^\d\d:00$/);
    await expect.poll(() => mapHour(page)).not.toBe(opening);
    // The arrow keys step it from either button; at the last day its arrow
    // is off and the focus stays in the control.
    await later(page).focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
    await expect(later(page)).toBeDisabled();
    await expect(earlier(page)).toBeFocused();
    await expect(shownDay(page)).not.toContainText(/Today|Tomorrow/);
    await expect.poll(() => mapHour(page)).toMatch(/^\d\d:\d\d$/);
    // Back to today, with Enter on the other arrow and the left key.
    for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowLeft");
    await expect(shownDay(page)).toContainText("Tomorrow");
    await page.keyboard.press("Enter");
    await expect(shownDay(page)).toHaveAttribute("data-finder-day", SAMPLE_DAY);
    await expect(earlier(page)).toBeDisabled();
    await expect(later(page)).toBeFocused();
    await expect(page.locator("[data-picked-hour]")).toHaveCount(0);
  });

  test("after dark it opens on tomorrow, and today ticks no hour it is not", async ({
    page,
  }) => {
    // The suite's own clock: 22:00 Irish summer time, after last light.
    await star(page, ["brandon", "keel"]);
    await page.goto("/");
    await expect(finder(page)).toBeVisible({ timeout: 30000 });
    await rated(page);
    await expect(shownDay(page)).toHaveAttribute(
      "data-finder-day",
      SAMPLE_TOMORROW,
    );
    await expect(shownDay(page)).toContainText("Tomorrow");
    expect(await barsOn(page)).toEqual([SAMPLE_TOMORROW]);
    await expect.poll(() => mapHour(page)).toMatch(/^\d\d:00$/);
    await expect(cards(page).locator("[data-shown-tick]")).toHaveCount(8);
    // Back to today: its rows ended at dusk, so no card ticks its last
    // hour for the hour now, and the pills stand at the hour now, nearest.
    await earlier(page).click();
    await expect(shownDay(page)).toContainText("Today");
    await expect.poll(() => barsOn(page)).toEqual([SAMPLE_DAY]);
    await expect(cards(page).locator("[data-shown-tick]")).toHaveCount(0);
    await expect.poll(() => mapHour(page)).toBe("22:00");
  });

  test("the hour now is the nearest one, on the cards and the chart's pills", async ({
    page,
  }) => {
    await star(page, ["brandon", "keel"]);
    // 14:59 Irish time: 15:00, not 14:00.
    await page.clock.setFixedTime(new Date(AFTERNOON.getTime() + 29 * 60000));
    await page.goto("/");
    await expect(finder(page)).toBeVisible({ timeout: 30000 });
    await rated(page);
    await expect.poll(() => mapHour(page)).toBe("15:00");
    await expect(cards(page).locator("[data-shown-tick]")).toHaveCount(8);
  });

  test("while the places and their hours load, the cards hold their shape and say so", async ({
    page,
  }) => {
    await star(page, ["brandon", "dollymount"]);
    let places!: () => void;
    const placesHeld = new Promise<void>((done) => (places = done));
    await page.route("**/spots.json", async (route) => {
      await placesHeld;
      await route.continue();
    });
    await page.clock.setFixedTime(AFTERNOON);
    await page.goto("/");
    const list = page.locator("[data-finder-list]");
    const ghosts = page.locator("[data-card-skeleton]");
    await expect(ghosts).toHaveCount(2);
    await expect(ghosts.first()).toContainText("Loading the spots…");
    await expect(list).toHaveAttribute("aria-busy", "true");
    const ghost = (await ghosts.first().boundingBox())!;
    places();
    await expect(cards(page)).toHaveCount(2);
    await expect(ghosts).toHaveCount(0);
    const card = (await cards(page).first().boundingBox())!;
    expect(Math.abs(card.y - ghost.y)).toBeLessThan(2);
    expect(Math.abs(card.height - ghost.height)).toBeLessThan(4);
  });

  test("a card opens the spot's page, its picture too; the top bar's Chart opens the full chart", async ({
    page,
  }) => {
    await star(page, ["brandon", "keel"]);
    await openFinder(page);
    await rated(page);
    // No way from a card to the chart: the chart is the top bar's.
    await expect(
      cards(page).getByRole("button", { name: /on the chart$/ }),
    ).toHaveCount(0);
    const keel = cards(page).filter({ hasText: "Keel Beach" });
    await keel.locator("[data-card-picture]").click();
    await expect(page).toHaveURL(/\/spot\/keel$/);
    await page.goBack();
    await expect(finder(page)).toBeVisible();
    await cards(page)
      .filter({ hasText: "Brandon Bay" })
      .getByText("Co. Kerry")
      .click();
    await expect(page).toHaveURL(/\/spot\/brandon$/);
    await page.goBack();
    await expect(finder(page)).toBeVisible();
    await expect(
      cards(page).getByRole("link", { name: "Brandon Bay" }),
    ).toHaveAttribute("href", "/spot/brandon");
    // No Full chart button on the map beside the list: the top bar has Chart.
    await expect(page.getByRole("button", { name: "Full chart" })).toHaveCount(
      0,
    );
    await page
      .locator("[data-top-bar]")
      .getByRole("link", { name: "Chart" })
      .click();
    await expect(page.locator('.workspace[data-chart="full"]')).toBeVisible({
      timeout: 30000,
    });
  });

  test("a card's loupe keeps its own colours: a white rim, never the page's default black", async ({
    page,
  }) => {
    await star(page, ["brandon"]);
    await openFinder(page);
    const rim = cards(page).first().locator("[data-loupe-rim]");
    await expect(rim).toHaveCSS("stroke", "rgb(255, 255, 255)");
  });

  test("the waves in metres, and water the sea's waves do not reach keeps its Waves row, empty", async ({
    page,
  }) => {
    // GFS-Wave alone: the sample's SWAN run, which the finder would read
    // first, starts a day after the evening this test looks at.
    await page.route("**/weather/mi-swan.json", (route) =>
      route.fulfill({ status: 404 }),
    );
    // Keel as a lough: the wave run is read, and does not have it.
    await page.route("**/gfs-wave-*/spots/*.json", async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      for (const key of ["spotSeries", "spotCoverage"])
        if (json[key]) delete json[key].keel;
      await route.fulfill({ response, json });
    });
    await star(page, ["brandon", "keel"]);
    await openFinder(page);
    await rated(page);
    // The sample's one wave run is three days out, three-hourly, its steps
    // at 19:00 and 22:00 Irish time on the evening of that day.
    for (let i = 0; i < 3; i++) await later(page).click();
    const brandon = cards(page).filter({ hasText: "Brandon Bay" });
    const keel = cards(page).filter({ hasText: "Keel Beach" });
    const sea = brandon.locator('[data-bar="waves"]');
    await expect(sea.locator("b").first()).toHaveText(/^\d+\.\d$/, {
      timeout: 30000,
    });
    await expect(sea).not.toHaveAttribute("data-inland");
    const lough = keel.locator('[data-bar="waves"]');
    await expect(lough).toHaveAttribute("data-inland");
    await expect(lough.locator("b")).toHaveCount(0);
    // The row is kept, the same height as the others, and still picks an
    // hour; the sky is drawn whatever the sea.
    expect((await lough.boundingBox())!.height).toBeCloseTo(
      (await sea.boundingBox())!.height,
      0,
    );
    await expect(keel.locator('[data-bar="sky"] b').first()).toHaveText(
      /^-?\d+°$/,
    );
    const box = (await lough.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height / 2);
    await expect(page.locator("[data-picked-hour]")).toHaveCount(2);
  });

  test("a card's star unstars it, and the list follows", async ({ page }) => {
    await star(page, ["brandon", "dollymount", "keel"]);
    await openFinder(page);
    await expect(cards(page)).toHaveCount(3);
    await cards(page)
      .filter({ hasText: "Keel" })
      .getByRole("button", { name: "Save Keel Beach" })
      .click();
    await expect(cards(page)).toHaveCount(2);
    await expect(page).toHaveURL(/\/$/);
    const stored = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "{}"),
      SPOTS_KEY,
    );
    expect(stored.starred).toEqual(["brandon", "dollymount"]);
  });

  test("a first visit, with no favourites, opens with the heart off; on, it says how to have some", async ({
    page,
    context,
  }) => {
    // Under the width for the map beside the list: the map a switch away.
    await page.setViewportSize({ width: 800, height: 900 });
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation(DUBLIN);
    await openFinder(page);
    await expect(finder(page)).toHaveAttribute("data-scope", "near");
    await expect(heart(page)).toHaveAttribute("aria-pressed", "false");
    // Not asked yet: the spots nearest the middle of Ireland and nothing over
    // them, with no distance that is not the rider's.
    await expect(cards(page)).toHaveCount(12, { timeout: 30000 });
    await expect(
      page.getByRole("button", { name: "Use my location" }),
    ).toHaveCount(0);
    await expect(cards(page).filter({ hasText: / km · / })).toHaveCount(0);
    // Asked on the rider's word, and the browser said where they are.
    await useMyLocation(page);
    await expect(cards(page).filter({ hasText: "Dollymount" })).toHaveCount(1, {
      timeout: 30000,
    });
    await expect(cards(page).first()).toContainText(/\d+ km.*Co\. /);
    await setHeart(page, true);
    const empty = page.locator("[data-finder-empty]");
    await expect(empty).toContainText(
      "No favourites yet. Press the heart on a spot’s card to save it here",
    );
    await expect(cards(page)).toHaveCount(0);
    // And a way from it to a spot to star: the top bar's search, Nearby,
    // or every spot's page.
    await expect(search(page)).toBeVisible();
    await expect(
      empty.getByRole("link", { name: "browse every spot" }),
    ).toHaveAttribute("href", "/spot");
    await empty.getByRole("link", { name: "spots nearby" }).click();
    await expect(finder(page)).toHaveAttribute("data-scope", "near");
    await expect(page).toHaveURL(/\/\?tab=near$/);
    await expect(cards(page).filter({ hasText: "Dollymount" })).toHaveCount(1);
  });

  test("the heart is in the address: pressed, reloaded, linked to, and kept through the full chart", async ({
    page,
  }) => {
    await star(page, ["brandon", "dollymount"]);
    await openFinder(page);
    // A bare root opens as it always did, the heart on, and names nothing.
    await expect(finder(page)).toHaveAttribute("data-scope", "favourites");
    await expect(heart(page)).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/\/$/);
    await setHeart(page, false);
    await expect(page).toHaveURL(/\/\?tab=near$/);
    await page.reload();
    await expect(finder(page)).toHaveAttribute("data-scope", "near");
    await expect(heart(page)).toHaveAttribute("aria-pressed", "false");
    // Through the full chart and back, the address still names it.
    await page
      .locator("[data-top-bar]")
      .getByRole("link", { name: "Chart" })
      .click();
    await expect(page).toHaveURL(/\/\?map$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/\?tab=near$/);
    await expect(finder(page)).toHaveAttribute("data-scope", "near");
    // A link to the favourites opens with the heart on.
    await openFinder(page, "/?tab=favourites");
    await expect(finder(page)).toHaveAttribute("data-scope", "favourites");
    await expect(heart(page)).toHaveAttribute("aria-pressed", "true");
    await expect(cards(page)).toHaveCount(2);
    // So does the old address, sent on to the root.
    await openFinder(page, "/spots?tab=near");
    await expect(page).toHaveURL(/\/\?tab=near$/);
    await expect(finder(page)).toHaveAttribute("data-scope", "near");
  });

  test("the list's head is one row, the day, the heart and the filter, and names the list with no count", async ({
    page,
  }) => {
    await star(page, ["brandon", "dollymount"]);
    await openFinder(page);
    await expect(cards(page)).toHaveCount(2);
    const heading = page.locator("[data-finder-heading]");
    await expect(heading).toHaveText("Favourites");
    await expect(
      page.getByRole("region", { name: "Favourites" }),
    ).toBeVisible();
    // No count anywhere at the head, and no tabs.
    await expect(page.locator("[data-finder-list]")).not.toContainText(
      /\d+ spots?\b(?! in view)/,
    );
    await expect(page.getByRole("group", { name: "Which spots" })).toHaveCount(
      0,
    );
    // ‹ Day ›, the heart, the filter: one row, in that order.
    const [day, love, filter] = [
      (await days(page).boundingBox())!,
      (await heart(page).boundingBox())!,
      (await page.locator("[data-finder-filter]").boundingBox())!,
    ];
    expect(love.x).toBeGreaterThanOrEqual(day.x + day.width);
    expect(filter.x).toBeGreaterThanOrEqual(love.x + love.width);
    const middle = (box: { y: number; height: number }) =>
      box.y + box.height / 2;
    expect(Math.abs(middle(love) - middle(day))).toBeLessThan(4);
    expect(Math.abs(middle(filter) - middle(day))).toBeLessThan(4);
    await setHeart(page, false);
    await expect(heading).toHaveText(/^Spots (in view|near you)$/);
    // On the screen; the filter opens the order, the stars and the model in
    // a sheet.
    await expect(days(page)).toBeInViewport();
    await expect(filters(page)).toBeHidden();
    await openFilters(page);
    await expect(filters(page)).toBeVisible();
    // The sheet shows every filter, not a body folded to its padding under
    // the first heading: on a desktop, and as a sheet at a phone's width.
    const unfolded = () =>
      filters(page).evaluate((el) => {
        const body = el.parentElement!;
        return body.clientHeight >= body.scrollHeight - 1;
      });
    expect(await unfolded()).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await unfolded()).toBe(true);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Done" })
      .click();
    await expect(filters(page)).toBeHidden();
  });

  test("the top bar's search finds a spot by name, from every spot, and chooses it on the map", async ({
    page,
  }) => {
    await star(page, ["brandon", "dollymount"]);
    await openFinder(page);
    await expect(cards(page)).toHaveCount(2);
    // "/" from the page comes to the search.
    await page.keyboard.press("/");
    await expect(search(page)).toBeFocused();
    // With nothing typed, the rider's own spots.
    const results = page.getByRole("listbox", { name: "Spots" });
    await expect(results.getByRole("option")).toHaveText([
      /Brandon Bay/,
      /Dollymount/,
    ]);
    // Filtered at once as it is typed, accents and case let go of, from
    // every spot and not only the tab's, a name's start first.
    await search(page).fill("KEEL");
    await expect(results.getByRole("option").first()).toContainText(
      "Keel Beach",
    );
    await expect(search(page)).toHaveAttribute("aria-expanded", "true");
    // The list behind is the tab's still.
    await expect(cards(page)).toHaveCount(2);
    await search(page).fill("no such place");
    await expect(page.locator("[data-spot-search-none]")).toHaveText(
      "No spots match “no such place”",
    );
    // Escape clears the words, then closes.
    await search(page).press("Escape");
    await expect(search(page)).toHaveValue("");
    await search(page).press("Escape");
    await expect(results).toHaveCount(0);
    // The keys move through the results, and Enter opens the one they are on.
    await search(page).focus();
    await search(page).fill("brand");
    await search(page).press("ArrowDown");
    await search(page).press("ArrowUp");
    const active = await search(page).getAttribute("aria-activedescendant");
    expect(active).toBeTruthy();
    await expect(page.locator(`[id="${active}"]`)).toContainText("Brandon Bay");
    await search(page).press("Enter");
    // The map flies to it, its pill light, and its card is outlined in view;
    // the page stays the finder.
    await expect(
      page.locator('.spot-marker.sel[data-spot-id="brandon"]'),
    ).toHaveCount(1, { timeout: 30000 });
    await expect(
      page.locator('[data-spot-card="brandon"][data-found]'),
    ).toBeInViewport({ timeout: 30000 });
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("the browser is never asked unasked: only the locate button asks", async ({
    page,
  }) => {
    await unanswered(page, DUBLIN);
    await page.addInitScript(() => {
      const w = window as unknown as { asked: number };
      w.asked = 0;
      const geo = navigator.geolocation;
      const ask = geo.getCurrentPosition.bind(geo);
      geo.getCurrentPosition = (...args) => {
        w.asked++;
        ask(...args);
      };
    });
    const asked = () =>
      page.evaluate(() => (window as unknown as { asked: number }).asked);
    await openFinder(page);
    await expect(finder(page)).toHaveAttribute("data-scope", "near");
    await expect(cards(page)).toHaveCount(12, { timeout: 30000 });
    await setHeart(page, true);
    await setHeart(page, false);
    // No "Use my location" in the filter sheet beside the map: the map has it.
    await openFilters(page);
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Use my location" }),
    ).toHaveCount(0);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Done" })
      .click();
    expect(await asked()).toBe(0);
    await useMyLocation(page);
    expect(await asked()).toBe(1);
    // With the heart on, the locate button turns it off, for the spots round
    // the rider.
    await setHeart(page, true);
    await useMyLocation(page);
    await expect(heart(page)).toHaveAttribute("aria-pressed", "false");
  });

  test("the list put in order, by its stars, and rated from another model", async ({
    page,
  }) => {
    await star(page, ["tramore", "brandon", "keel", "dollymount"]);
    await openFinder(page);
    await rated(page);
    // The filters are behind the filter button, and the list follows them
    // as they are set.
    await expect(page.locator("[data-finder-filter]")).not.toHaveAttribute(
      "data-narrowed",
    );
    await openFilters(page);
    const order = filters(page).getByRole("group", { name: "Order" });
    // A to Z.
    await order.getByRole("button", { name: "A to Z" }).click();
    await expect(order.getByRole("button", { name: "A to Z" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const names = await cards(page).evaluateAll((els) =>
      els.map((el) => el.querySelector("h3")?.textContent?.trim() ?? ""),
    );
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    // Nearest needs the rider's place, which this browser has not given.
    await expect(order.getByRole("button")).toHaveText([
      "Best first",
      "A to Z",
    ]);
    // Only the places with five stars on the day shown, or a line saying
    // there are none.
    const stars = filters(page).getByRole("group", { name: "Stars today" });
    await stars.getByRole("button", { name: "5 stars" }).click();
    await expect(
      stars.getByRole("button", { name: "5 stars" }),
    ).toHaveAttribute("aria-pressed", "true");
    const best = await cards(page).evaluateAll((els) =>
      els.map((el) => Number(el.getAttribute("data-best"))),
    );
    if (best.length) expect(best.every((n) => n === 5)).toBe(true);
    else
      await expect(page.locator("[data-finder-empty]")).toHaveText(
        "No spot on this list has 5 stars today.",
      );
    // The button says the list is narrowed; Clear puts the order and the
    // stars back.
    await expect(page.locator("[data-finder-filter]")).toHaveAttribute(
      "data-narrowed",
      "true",
    );
    await page.locator("[data-finder-clear]").click();
    await expect(
      order.getByRole("button", { name: "Best first" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      stars.getByRole("button", { name: "Any stars" }),
    ).toHaveAttribute("aria-pressed", "true");
    // The model: the rider's own, kept, as the spot page sets it.
    await filters(page)
      .getByRole("group", { name: "Model for the stars" })
      .getByRole("button", { name: "ECMWF" })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("force5.prefs.v1") ?? ""),
      )
      .toContain("ecmwf");
  });

  test("a first visit with the location refused lists the spots nearest the middle of Ireland, and never asks again", async ({
    page,
  }) => {
    // Under the width for the map beside the list: the map a switch away.
    await page.setViewportSize({ width: 800, height: 900 });
    // No permission: the browser says no, once asked.
    await openFinder(page);
    await expect(finder(page)).toHaveAttribute("data-scope", "near");
    await expect(cards(page)).toHaveCount(12, { timeout: 30000 });
    await useMyLocation(page);
    await expect(page.locator("[data-finder-empty]")).toHaveCount(0);
    // No distance from a place the rider is not at.
    await expect(cards(page).filter({ hasText: / km · / })).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate((key) => localStorage.getItem(key), LOCATION_KEY),
      )
      .toBe(JSON.stringify({ refused: true }));
    // Back again: the same list, and the browser is not asked.
    await page.addInitScript(() => {
      const w = window as unknown as { asked: number };
      w.asked = 0;
      const geo = navigator.geolocation;
      const ask = geo.getCurrentPosition.bind(geo);
      geo.getCurrentPosition = (...args) => {
        w.asked++;
        ask(...args);
      };
    });
    await page.reload();
    await expect(cards(page)).toHaveCount(12, { timeout: 30000 });
    expect(
      await page.evaluate(() => (window as unknown as { asked: number }).asked),
    ).toBe(0);
  });

  test("while the browser is asked, says so; the rider's answer lists the spots round them", async ({
    page,
  }) => {
    await unanswered(page, DUBLIN);
    await openFinder(page);
    await useMyLocation(page);
    await expect(page.locator("[data-finder-empty]")).toHaveText(
      "Finding spots nearby…",
    );
    await expect(cards(page)).toHaveCount(0);
    await page.evaluate(() =>
      (window as unknown as { answerWhere: () => void }).answerWhere(),
    );
    await expect(cards(page).filter({ hasText: "Dollymount" })).toHaveCount(1, {
      timeout: 30000,
    });
    await expect(page.locator("[data-finder-empty]")).toHaveCount(0);
  });

  test("a browser that never answers: after a few seconds, the spots on the map", async ({
    page,
  }) => {
    // Under the width for the map beside the list: the map a switch away.
    await page.setViewportSize({ width: 800, height: 900 });
    await unanswered(page, DUBLIN);
    await openFinder(page);
    await useMyLocation(page);
    await expect(page.locator("[data-finder-empty]")).toHaveText(
      "Finding spots nearby…",
    );
    // Under this width too the list is the map's spots, the heart off.
    await expect
      .poll(() => cards(page).count(), { timeout: 30000 })
      .toBeGreaterThan(0);
    // A late answer still brings the spots round the rider.
    await page.evaluate(() =>
      (window as unknown as { answerWhere: () => void }).answerWhere(),
    );
    await expect(cards(page).filter({ hasText: "Dollymount" })).toHaveCount(1, {
      timeout: 30000,
    });
  });

  test("a rider with nothing within 30 km has the map round them and the nearest spots", async ({
    page,
    context,
  }) => {
    // Under the width for the map beside the list: the map a switch away.
    await page.setViewportSize({ width: 800, height: 900 });
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation(ATHLONE);
    await openFinder(page);
    await useMyLocation(page);
    // The list is the map's, and the map opens round them and the few
    // nearest spots: never empty.
    await expect
      .poll(() => cards(page).count(), { timeout: 30000 })
      .toBeGreaterThan(0);
    expect(await cards(page).count()).toBeLessThanOrEqual(30);
  });

  test("with favourites, opens on them and does not ask where the rider is", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { asked: number };
      w.asked = 0;
      Object.defineProperty(navigator, "geolocation", {
        value: {
          getCurrentPosition: () => w.asked++,
          watchPosition: () => 0,
          clearWatch: () => {},
        },
      });
    });
    await star(page, ["brandon"]);
    await openFinder(page);
    await expect(finder(page)).toHaveAttribute("data-scope", "favourites");
    await expect(cards(page)).toHaveCount(1);
    expect(
      await page.evaluate(() => (window as unknown as { asked: number }).asked),
    ).toBe(0);
  });

  test("the locate button lists the spots round the rider, close in the nearest the map's middle first", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation(DUBLIN);
    await star(page, ["brandon"]);
    await openFinder(page);
    await setHeart(page, false);
    await expect(finder(page)).toHaveAttribute("data-scope", "near");
    await useMyLocation(page);
    // Dublin's beaches, and not Brandon, the far side of the country.
    await expect(cards(page).filter({ hasText: "Dollymount" })).toHaveCount(1, {
      timeout: 30000,
    });
    await expect(cards(page).filter({ hasText: "Brandon" })).toHaveCount(0);
    expect(await cards(page).count()).toBeGreaterThan(3);
    // The map opens round the rider, under 120 km across: the list is the
    // nearest its middle first, which is the rider, whatever their stars.
    await rated(page);
    await expect(cards(page).first()).toContainText(/\d+ km.*Co\. /);
    // Once the map has come to rest round them.
    const nearestFirst = async () => {
      const km = await cards(page)
        .locator("[data-km]")
        .evaluateAll((els) =>
          els.map((el) => Number(/\d+/.exec(el.textContent ?? "")?.[0] ?? 0)),
        );
      return km.length > 3 && km.every((d, i) => !i || d >= km[i - 1] - 1);
    };
    await expect.poll(nearestFirst, { timeout: 15000 }).toBe(true);
    const kept = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("wingfoil.finder.location.v1") ?? "{}"),
    );
    expect(kept.at.lat).toBeCloseTo(DUBLIN.latitude, 3);
  });

  test("nearby, refused, looks round where the chart was, and never asks again", async ({
    page,
  }) => {
    // Under the width for the map beside the list: the map a switch away.
    await page.setViewportSize({ width: 800, height: 900 });
    await star(page, ["brandon"]);
    // No permission: the browser says no.
    await page.addInitScript(() =>
      localStorage.setItem(
        "wingfoil.map.centre.v1",
        JSON.stringify({ lat: 53.35, lon: -6.2 }),
      ),
    );
    await openFinder(page);
    await setHeart(page, false);
    await useMyLocation(page);
    await expect(cards(page).filter({ hasText: "Dollymount" })).toHaveCount(1, {
      timeout: 30000,
    });
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem("wingfoil.finder.location.v1"),
        ),
      )
      .toBe(JSON.stringify({ refused: true }));
  });

  test("high and low water are left off the cards, a place with a tide or without (the owner's ruling of 2026-10-28)", async ({
    page,
  }) => {
    // Brandon's station has published turns today; Keel has none.
    const day = AFTERNOON.toISOString().slice(0, 10);
    const events = [
      { time: `${day}T09:10:00Z`, kind: "low", height: 0.8 },
      { time: `${day}T15:25:00Z`, kind: "high", height: 3.6 },
      { time: `${day}T21:40:00Z`, kind: "low", height: 0.9 },
    ];
    await page.route("**/marine/tides.json", (route) =>
      route.fulfill({
        json: {
          schemaVersion: 1,
          kind: "tide",
          stations: [{ id: "Fenit", name: "Fenit", lat: 52.27, lon: -9.86 }],
          spots: {
            brandon: { station: "Fenit", distanceKm: 10.9 },
            keel: { station: null, distanceKm: 60, reason: "Too far." },
          },
        },
      }),
    );
    await page.route("**/marine/tides/Fenit.json", (route) =>
      route.fulfill({
        json: {
          stepMinutes: 30,
          from: `${day}T00:00:00Z`,
          to: `${day}T23:30:00Z`,
          datum: "LAT",
          curve: Array.from({ length: 48 }, () => 2),
          events,
        },
      }),
    );
    await star(page, ["brandon", "keel"]);
    await openFinder(page);
    const brandon = cards(page).filter({ hasText: "Brandon Bay" });
    const keel = cards(page).filter({ hasText: "Keel Beach" });
    await rated(page);
    await expect(brandon.locator('[data-bar="wind"]')).toBeVisible();
    await expect(brandon.locator("[data-tide-time], [data-tide]")).toHaveCount(
      0,
    );
    await expect(keel.locator("[data-tide-time], [data-tide]")).toHaveCount(0);
  });

  test("is in the site menu, the home page, and the chart is in its menu", async ({
    page,
  }) => {
    await page.goto("/?map");
    await expect(page.locator(".spot-marker")).toHaveCount(149, {
      timeout: 30000,
    });
    await page.getByRole("button", { name: "Site menu" }).click();
    const row = siteRow(page, "Spot finder");
    await expect(row).toHaveAttribute("href", "/");
    await page.evaluate(() => ((window as { stayed?: boolean }).stayed = true));
    // Second in the navigation, under the chart and over Settings.
    const chart = (await siteRow(page, "Chart").boundingBox())!;
    const settings = (await siteRow(page, "Settings").boundingBox())!;
    const box = (await row.boundingBox())!;
    expect(chart.y).toBeLessThan(box.y);
    expect(box.y).toBeLessThan(settings.y);
    await row.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(finder(page)).toBeVisible();
    // No page load: the chart's own data, and its lights, wait behind it.
    expect(
      await page.evaluate(() => (window as { stayed?: boolean }).stayed),
    ).toBe(true);
    // The finder's menu: the same navigation, the finder marked as the page.
    await page.getByRole("button", { name: "Site menu" }).click();
    await expect(siteRow(page, "Spot finder")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(siteRow(page, "Settings")).toBeVisible();
    await siteRow(page, "Chart").click();
    await expect(page).toHaveURL(/\/\?map$/);
    await expect(page.locator(".spot-marker")).toHaveCount(149);
    expect(
      await page.evaluate(() => (window as { stayed?: boolean }).stayed),
    ).toBe(true);
    // Settings from the finder opens over it, with no page load.
    await page.goBack();
    await expect(finder(page)).toBeVisible();
    await page.getByRole("button", { name: "Site menu" }).click();
    await siteRow(page, "Settings").click();
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("the spot page's menu is the same navigation, the finder and Settings in it", async ({
    page,
  }) => {
    await page.goto("/spot/brandon");
    await page.getByRole("button", { name: "Site menu" }).click();
    await expect(siteNav(page).getByRole("link")).toHaveText(SITE_ROW_TEXTS);
    // Neither of the menu's pages is this one, and it has no tools of its own:
    // and no group: light, dark or auto is in Settings.
    await expect(siteNav(page).locator('[aria-current="page"]')).toHaveCount(0);
    await expect(
      page.getByRole("dialog", { name: "Site menu" }).getByRole("group"),
    ).toHaveCount(0);
    await expect(siteRow(page, "Settings")).toHaveAttribute(
      "href",
      "/?settings",
    );
    const row = siteRow(page, "Spot finder");
    await expect(row).toHaveAttribute("href", "/");
    await row.click();
    await expect(finder(page)).toBeVisible({ timeout: 30000 });
  });

  test("Settings from a spot's page is the home page with Settings open", async ({
    page,
  }) => {
    // Loaded alone: a page load to the home page, the word gone from the
    // address.
    await page.goto("/spot/brandon");
    await page.getByRole("button", { name: "Site menu" }).click();
    await siteRow(page, "Settings").click();
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible({
      timeout: 30000,
    });
    await expect(page).toHaveURL(/\/$/);
    await expect(finder(page)).toBeVisible();
  });

  test("an old link to Customise opens Settings on the home page", async ({
    page,
  }) => {
    await page.goto("/?customise");
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible({
      timeout: 30000,
    });
    await expect(page).toHaveURL(/\/$/);
  });

  test("Settings from a spot's page over the finder is the finder with Settings open", async ({
    page,
  }) => {
    await star(page, ["brandon"]);
    await openFinder(page);
    await page.evaluate(() => ((window as { stayed?: boolean }).stayed = true));
    // The spot's page, over the finder (src/PagesOverMap.tsx).
    await cards(page).getByRole("link", { name: "Brandon Bay" }).click();
    await expect(page).toHaveURL(/\/spot\/brandon$/);
    await expect(page.locator(".map-under-page")).toHaveCount(1);
    await page.getByRole("button", { name: "Site menu" }).click();
    await siteRow(page, "Settings").click();
    await expect(page.locator(".map-under-page")).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    expect(
      await page.evaluate(() => (window as { stayed?: boolean }).stayed),
    ).toBe(true);
  });

  test("the menu's Chart is always the full chart, and its Spot finder the home page, from a page loaded alone", async ({
    page,
  }) => {
    await page.goto("/spot/brandon");
    await page.getByRole("button", { name: "Site menu" }).click();
    await expect(siteRow(page, "Chart")).toHaveAttribute("href", "/?map");
    await siteRow(page, "Chart").click();
    await expect(page.locator('[data-view-switch="spots"]')).toBeVisible({
      timeout: 30000,
    });
    await expect(page).toHaveURL(/\/\?map$/);

    await page.goto("/spot/brandon");
    await page.getByRole("button", { name: "Site menu" }).click();
    await siteRow(page, "Spot finder").click();
    await expect(finder(page)).toBeVisible({ timeout: 30000 });
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('[data-view-switch="spots"]')).toHaveCount(0);

    // The AI page's menu's Chart is the chart too.
    await page.goto("/ai");
    await page.getByRole("button", { name: "Site menu" }).click();
    await siteRow(page, "Chart").click();
    await expect(page.locator('[data-view-switch="spots"]')).toBeVisible({
      timeout: 30000,
    });
    await expect(page).toHaveURL(/\/\?map$/);
  });

  test("the menu's Chart from a spot's page over the finder is the chart", async ({
    page,
  }) => {
    await star(page, ["brandon"]);
    await openFinder(page);
    await page.evaluate(() => ((window as { stayed?: boolean }).stayed = true));
    await cards(page).getByRole("link", { name: "Brandon Bay" }).click();
    await expect(page.locator(".map-under-page")).toHaveCount(1);
    await page.getByRole("button", { name: "Site menu" }).click();
    await siteRow(page, "Chart").click();
    await expect(page.locator(".map-under-page")).toHaveCount(0);
    await expect(page.locator('[data-view-switch="spots"]')).toBeVisible();
    await expect(page).toHaveURL(/\/\?map$/);
    // No page load: the map was kept under the page.
    expect(
      await page.evaluate(() => (window as { stayed?: boolean }).stayed),
    ).toBe(true);
  });

  test("the root is always the home page; the old addresses are put right", async ({
    page,
  }) => {
    // The full chart last open makes no difference to the root.
    await page.goto("/?map");
    await expect(page.locator('[data-view-switch="spots"]')).toBeVisible({
      timeout: 30000,
    });
    await page.goto("/");
    await expect(finder(page)).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-view-switch="spots"]')).toHaveCount(0);
    // The spot finder's old address is the home page.
    await page.goto("/spots");
    await expect(page).toHaveURL(/\/$/);
    await expect(finder(page)).toBeVisible({ timeout: 30000 });
    // The chart's old word is the full chart's new one.
    await page.goto("/?chart");
    await expect(page).toHaveURL(/\/\?map$/);
    await expect(page.locator('[data-view-switch="spots"]')).toBeVisible({
      timeout: 30000,
    });
    // A link to a spot on the chart is the full chart on it, with its week
    // in the scrub bar.
    await page.goto("/?spot=brandon");
    await expect(barName(page)).toHaveText("Brandon Bay", {
      timeout: 30000,
    });
    await expect(page.locator('[data-view-switch="spots"]')).toBeVisible();
  });
});

test.describe("on a window with no chart beside the list", () => {
  test.use({ viewport: { width: 1000, height: 900 } });

  test("two cards a row, so a card's hours never stretch across it", async ({
    page,
  }) => {
    await star(page, ["brandon", "dollymount"]);
    await openFinder(page);
    await expect(cards(page)).toHaveCount(2);
    const [a, b] = [
      (await cards(page).nth(0).boundingBox())!,
      (await cards(page).nth(1).boundingBox())!,
    ];
    expect(b.y).toBe(a.y);
    expect(b.x).toBeGreaterThan(a.x + a.width);
  });
});

test.describe("on a narrower window", () => {
  test.use({ viewport: { width: 800, height: 900 } });

  test("one card a row, under the room two need", async ({ page }) => {
    await star(page, ["brandon", "dollymount"]);
    await openFinder(page);
    await expect(cards(page)).toHaveCount(2);
    const [a, b] = [
      (await cards(page).nth(0).boundingBox())!,
      (await cards(page).nth(1).boundingBox())!,
    ];
    expect(b.x).toBe(a.x);
    expect(b.y).toBeGreaterThan(a.y + a.height);
  });
});

test.describe("on a phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test("the top bar keeps the wordmark, the search, Chart and the menu in one row", async ({
    page,
  }) => {
    await star(page, ["brandon"]);
    await openFinder(page);
    const bar = page.locator("[data-top-bar]");
    const mark = bar.getByText("wingfoil.ie");
    await expect(mark).toBeVisible();
    const [name, find, chart, menu] = [
      (await mark.boundingBox())!,
      (await bar.getByRole("button", { name: "Search spots" }).boundingBox())!,
      (await bar.getByRole("link", { name: "Chart" }).boundingBox())!,
      (await bar.getByRole("button", { name: "Site menu" }).boundingBox())!,
    ];
    // In one row, in that order, all on the screen; light or dark is in the
    // menu on a phone.
    expect(find.x).toBeGreaterThanOrEqual(name.x + name.width);
    expect(chart.x).toBeGreaterThanOrEqual(find.x + find.width);
    expect(menu.x).toBeGreaterThanOrEqual(chart.x + chart.width);
    expect(menu.x + menu.width).toBeLessThanOrEqual(390);
    await expect(bar.locator("[data-theme-button]")).toBeHidden();
    // The search opens over the bar, the width of the screen.
    await bar.getByRole("button", { name: "Search spots" }).tap();
    await expect(search(page)).toBeFocused();
    const field = (await search(page).boundingBox())!;
    expect(field.width).toBeGreaterThan(250);
    await search(page).fill("keel");
    await expect(
      page.getByRole("listbox", { name: "Spots" }).getByRole("option").first(),
    ).toContainText("Keel Beach");
    await page.getByRole("button", { name: "Cancel" }).tap();
    await expect(page.getByRole("listbox", { name: "Spots" })).toHaveCount(0);
    await toList(page);
    // ‹ Day ›, the heart and the filter share a row, in that order, on the
    // screen.
    const day = (await days(page).boundingBox())!;
    const love = (await heart(page).boundingBox())!;
    const filter = (await page.locator("[data-finder-filter]").boundingBox())!;
    expect(day.x).toBeGreaterThanOrEqual(0);
    expect(love.x).toBeGreaterThanOrEqual(day.x + day.width);
    expect(filter.x).toBeGreaterThanOrEqual(love.x + love.width);
    expect(filter.x + filter.width).toBeLessThanOrEqual(390);
    const middle = (box: { y: number; height: number }) =>
      box.y + box.height / 2;
    expect(Math.abs(middle(filter) - middle(day))).toBeLessThan(4);
    expect(Math.abs(middle(love) - middle(day))).toBeLessThan(4);
  });

  test("one column, no wider than the screen, an hour tapped on the bars", async ({
    page,
  }) => {
    await star(page, ["brandon", "keel"]);
    await openFinder(page);
    await toList(page);
    await rated(page);
    const a = (await cards(page).first().boundingBox())!;
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.x + a.width).toBeLessThanOrEqual(390);
    const bar = cards(page).first().locator('[data-bar="stars"]');
    const box = (await bar.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height / 2);
    await expect(page.locator("[data-picked-hour]")).toHaveCount(2);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("a first visit on a phone opens with the heart off; on, it is empty", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation(DUBLIN);
    await openFinder(page);
    await useMyLocation(page);
    await expect(cards(page).filter({ hasText: "Dollymount" })).toHaveCount(1, {
      timeout: 30000,
    });
    await heart(page).tap();
    await expect(heart(page)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-finder-empty]")).toContainText(
      "No favourites yet.",
    );
    await heart(page).tap();
    await expect(heart(page)).toHaveAttribute("aria-pressed", "false");
    await expect(cards(page).filter({ hasText: "Dollymount" })).toHaveCount(1);
  });

  test("a first visit on a phone with the location refused still lists spots: the map's", async ({
    page,
  }) => {
    await openFinder(page);
    await toList(page);
    await expect(finder(page)).toHaveAttribute("data-scope", "near");
    await expect
      .poll(() => cards(page).count(), { timeout: 30000 })
      .toBeGreaterThan(0);
    expect(await cards(page).count()).toBeLessThanOrEqual(30);
    // No "Use my location" in the filter sheet: the map has the button.
    await openFilters(page);
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Use my location" }),
    ).toHaveCount(0);
  });
});
