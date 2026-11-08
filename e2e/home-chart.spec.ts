import {
  barName,
  expect,
  scrubBar,
  SPOTS_KEY,
  test,
  type Page,
} from "./fixtures";

/**
 * The home page: the spot finder's list, with the chart beside it on a wide
 * screen, and the full chart opened out of it (src/App.tsx, the approved
 * mock-up, #238). One map, never
 * taken down: the panel beside the list and the full chart are the same map
 * in a bigger box.
 */

const DUBLIN = { latitude: 53.35, longitude: -6.26 };

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
const cards = (page: Page) => page.locator("[data-spot-card]");
const panel = (page: Page) =>
  page.getByRole("region", { name: "The chart, at the spots on the list" });
const lights = (page: Page) => page.locator(".spot-marker");
/** The cards the rider can see, as pills on the map; every other spot is a bead. */
const pills = (page: Page) => page.locator(".spot-marker.lt-pilled");
const beads = (page: Page) => page.locator(".spot-marker.lt-bead");
/** How many cards are at least half in the list's view: a pill each. */
const seen = (page: Page) =>
  page.locator("[data-finder-list]").evaluate((list) => {
    const view = list.getBoundingClientRect();
    return [...list.querySelectorAll("[data-spot-card]")].filter((card) => {
      const r = card.getBoundingClientRect();
      return (
        Math.min(r.bottom, view.bottom) - Math.max(r.top, view.top) >=
        r.height / 2
      );
    }).length;
  });
/** The top bar over the list and the chart alike (ui/TopBar.tsx). */
const bar = (page: Page) => page.locator("[data-top-bar]");
/** The bar's button to the list, on the full chart. */
const listButton = (page: Page) =>
  bar(page).getByRole("link", { name: "Spots", exact: true });
/** The bar's button to the full chart, on the list. */
const mapButton = (page: Page) =>
  bar(page).getByRole("link", { name: "Chart", exact: true });
/** On the full chart: the bar's button is the way back to the list. */
const onChart = (page: Page) => page.locator('[data-view-switch="spots"]');
/** The heart at the list's head: on, the favourites; off, the spots in view. */
const heart = (page: Page) =>
  page
    .locator("[data-finder-list]")
    .getByRole("button", { name: "Favourites" });
/** The locate button on the chart beside the list. */
const locate = (page: Page) =>
  panel(page).getByRole("button", { name: "Use my location" });

/** Marks the map's canvas, so a map drawn afresh is told from the one kept. */
const mark = (page: Page) =>
  page.evaluate(() => {
    document.querySelector<HTMLElement>(".maplibregl-canvas")!.dataset.kept =
      "1";
  });
const kept = (page: Page) =>
  page.evaluate(
    () =>
      document.querySelectorAll(".maplibregl-canvas").length === 1 &&
      document.querySelector<HTMLElement>(".maplibregl-canvas")?.dataset
        .kept === "1",
  );

/** How many of the list's pills stand inside the box beside the list. */
const pillsInside = async (page: Page) => {
  const box = (await panel(page).boundingBox())!;
  const at = await pills(page).evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }),
  );
  return at.filter(
    (p) =>
      p.x >= box.x &&
      p.x <= box.x + box.width &&
      p.y >= box.y &&
      p.y <= box.y + box.height,
  ).length;
};

/** The home page at 1440, its favourites listed and the chart beside them. */
async function openHome(page: Page, ids = ["brandon", "dollymount", "keel"]) {
  await star(page, ids);
  await page.goto("/");
  await expect(cards(page)).toHaveCount(ids.length, { timeout: 30000 });
  await expect(pills(page)).toHaveCount(ids.length, { timeout: 30000 });
}

test.describe("on a wide screen", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the list is the home page, and the chart beside it shows every spot, the listed ones as pills, fitted to them, with no scrub bar", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openHome(page);
    await expect(page).toHaveURL(/\/$/);
    // Beside the list, under the top bar, the full height of the page.
    const box = (await panel(page).boundingBox())!;
    const card = (await cards(page).first().boundingBox())!;
    const head = (await bar(page).boundingBox())!;
    expect(box.x).toBeGreaterThan(card.x + card.width);
    expect(box.y).toBeGreaterThan(head.y + head.height);
    expect(box.y + box.height).toBeGreaterThan(880);
    // Its own few controls, the zoom and the locate button under it, and
    // none of the full chart's: no Full chart button (the top bar has Chart)
    // and nothing at its foot.
    const zoom = (await panel(page)
      .getByRole("button", { name: "Zoom out" })
      .boundingBox())!;
    const here = (await locate(page).boundingBox())!;
    expect(here.y).toBeGreaterThan(zoom.y + zoom.height);
    expect(
      Math.abs(here.x + here.width / 2 - (zoom.x + zoom.width / 2)),
    ).toBeLessThan(2);
    await expect(
      panel(page).getByRole("button", { name: "Full chart" }),
    ).toHaveCount(0);
    await expect(page.locator(".panel-foot, [data-panel-when]")).toHaveCount(0);
    await expect(onChart(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Layers" })).toHaveCount(0);
    // The pills stand at the cards' hour, which each names.
    await expect(pills(page).first()).toHaveAttribute(
      "aria-label",
      /: \d\d:\d\d /,
    );
    // And every other spot, a bead.
    await expect(lights(page)).toHaveCount(149);
    await expect(beads(page)).toHaveCount(146);
    // Every listed spot's light is inside the panel.
    for (const light of await pills(page).all()) {
      const l = (await light.boundingBox())!;
      expect(l.x).toBeGreaterThan(box.x);
      expect(l.x + l.width).toBeLessThan(box.x + box.width);
      expect(l.y).toBeGreaterThan(box.y);
      expect(l.y + l.height).toBeLessThan(box.y + box.height);
    }
    // No loupe and no range ring beside the list, and no scrub bar: beside
    // the list the time is the cards'.
    await expect(page.locator(".map-focus > *")).toHaveCount(0);
    await expect(scrubBar(page)).toHaveCount(0);
    // A pill is a card in view already: pressed, it opens its spot's page.
    await page.locator('.spot-marker[data-spot-id="keel"]').click();
    await expect(page).toHaveURL(/\/spot\/keel/);
    expect(errors).toEqual([]);
  });

  test("a card under the pointer lights its spot; a light under the pointer outlines its card", async ({
    page,
  }) => {
    await openHome(page);
    const keel = cards(page).filter({ hasText: "Keel Beach" });
    await keel.hover();
    await expect(page.locator('.spot-marker[data-spot-id="keel"]')).toHaveClass(
      /\blit\b/,
    );
    await expect(page.locator(".spot-marker.lit")).toHaveCount(1);
    // Another card, another light.
    await cards(page).filter({ hasText: "Brandon Bay" }).hover();
    await expect(
      page.locator('.spot-marker[data-spot-id="brandon"]'),
    ).toHaveClass(/\blit\b/);
    await expect(page.locator(".spot-marker.lit")).toHaveCount(1);
    // A hover never zooms the chart.
    const zoom = await page.evaluate(
      () => document.querySelector(".map-canvas")?.className ?? "",
    );
    // The card brings its light into view a moment after the pointer comes
    // to rest on it (src/App.tsx hoverCard): left at once, it never does.
    const inside = async (id: string) => {
      const box = (await panel(page).boundingBox())!;
      const at = await page
        .locator(`.spot-marker[data-spot-id="${id}"]`)
        .boundingBox();
      return (
        !!at &&
        at.x > box.x &&
        at.x + at.width < box.x + box.width &&
        at.y > box.y &&
        at.y + at.height < box.y + box.height
      );
    };
    await expect.poll(() => inside("brandon")).toBe(true);
    await page.mouse.move(5, 5);
    // And a light under the pointer outlines its card, once the chart is at
    // rest (through a move its lights are drawn, not buttons).
    await expect(page.locator(".map-lights.is-moving")).toHaveCount(0);
    await page.waitForTimeout(400);
    await expect(page.locator(".map-lights.is-moving")).toHaveCount(0);
    // Brandon's light, which its card has just brought to the chart's middle.
    // Not Dollymount's: the hovers have panned the chart west (a card whose
    // light sits near the edge pans it to the middle, src/chartPanel.ts
    // inView), and Dublin is off the chart, a light nobody can point at. The
    // test's hover scrolled the clipped chart to reach it, and the light then
    // slid from under the pointer.
    const brandon = page.locator('.spot-marker[data-spot-id="brandon"]');
    const box = (await panel(page).boundingBox())!;
    const at = (await brandon.boundingBox())!;
    expect(at.x).toBeGreaterThan(box.x);
    expect(at.x + at.width).toBeLessThan(box.x + box.width);
    expect(at.y).toBeGreaterThan(box.y);
    expect(at.y + at.height).toBeLessThan(box.y + box.height);
    await brandon.hover();
    await expect(
      cards(page).filter({ hasText: "Brandon Bay" }),
    ).toHaveAttribute("data-lit", "");
    await expect(page.locator("[data-spot-card][data-lit]")).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.querySelector(".map-canvas")?.className ?? "",
      ),
    ).toBe(zoom);
  });

  test("the top bar's Chart opens the same map full screen, every spot and the chart's tools; Back, List, the collapse and Escape return to the list", async ({
    page,
  }) => {
    await openHome(page);
    await mark(page);
    const open = async () => {
      await mapButton(page).click();
      await expect(page).toHaveURL(/\/\?map$/);
      await expect(onChart(page)).toBeVisible();
      await expect(lights(page)).toHaveCount(149);
      await expect(
        page
          .getByRole("group", { name: "Map controls" })
          .getByRole("button", { name: "Layers" }),
      ).toBeVisible();
      await expect(listButton(page)).toBeVisible();
      // The whole screen under the top bar, the list under it and out of reach.
      const box = (await page.locator(".workspace").boundingBox())!;
      expect(box).toEqual({ x: 0, y: 64, width: 1440, height: 836 });
      await expect(page.locator(".finder-under")).toHaveAttribute("inert", "");
      expect(await kept(page)).toBe(true);
    };
    const back = async () => {
      await expect(page).toHaveURL(/\/$/);
      await expect(panel(page)).toBeVisible();
      await expect(pills(page)).toHaveCount(3);
      await expect(onChart(page)).toHaveCount(0);
      expect(await kept(page)).toBe(true);
    };
    await open();
    await page.goBack();
    await back();
    await open();
    await listButton(page).click();
    await back();
    await open();
    await page.getByRole("button", { name: "Back to the list" }).click();
    await back();
    await open();
    await page.keyboard.press("Escape");
    await back();
    // Forward is the full chart again.
    await page.goForward();
    await expect(onChart(page)).toBeVisible();
  });

  test("on the full chart a spot opens its week in the scrub bar; the top bar's Spots takes the reader to the list, the scrub bar gone", async ({
    page,
  }) => {
    await openHome(page);
    await mapButton(page).click();
    await expect(lights(page)).toHaveCount(149);
    await page.locator('.spot-marker[data-spot-id="brandon"]').click();
    await expect(barName(page)).toHaveText("Brandon Bay", {
      timeout: 30000,
    });
    await expect(page).toHaveURL(/\/\?spot=brandon$/);
    // The scrub bar stands under the top bar, never over it.
    const top = (await bar(page).boundingBox())!;
    expect((await scrubBar(page).boundingBox())!.y).toBeGreaterThanOrEqual(
      top.y + top.height,
    );
    // With a spot open, Spots is the list, and the scrub bar is gone with it.
    await listButton(page).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(panel(page)).toBeVisible();
    await expect(scrubBar(page)).toHaveCount(0);
  });

  test("the bar's search on the full chart flies to the spot picked and opens it", async ({
    page,
  }) => {
    await openHome(page);
    await mapButton(page).click();
    await expect(lights(page)).toHaveCount(149);
    const find = page.getByRole("combobox", { name: "Search spots" });
    await find.fill("keel");
    await expect(
      page.getByRole("listbox", { name: "Spots" }).getByRole("option").first(),
    ).toContainText("Keel Beach");
    await find.press("Enter");
    await expect(barName(page)).toHaveText("Keel Beach", {
      timeout: 30000,
    });
    await expect(page).toHaveURL(/\/\?spot=keel$/);
    await expect(find).toHaveValue("");
  });

  test("a card's picture opens its spot's page, not the chart; Back is the list", async ({
    page,
  }) => {
    await openHome(page);
    await cards(page)
      .filter({ hasText: "Keel Beach" })
      .locator("[data-card-picture]")
      .click();
    await expect(page).toHaveURL(/\/spot\/keel$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(panel(page)).toBeVisible();
    await expect(scrubBar(page)).toHaveCount(0);
  });

  test("a link to a spot opens the full chart on it with its week, and List goes on to the list", async ({
    page,
  }) => {
    await star(page, ["brandon"]);
    await page.goto("/?spot=brandon");
    await expect(barName(page)).toHaveText("Brandon Bay", {
      timeout: 30000,
    });
    await expect(onChart(page)).toBeVisible();
    await listButton(page).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(cards(page)).toHaveCount(1);
    await expect(scrubBar(page)).toHaveCount(0);
    // A step on, not back: Back is the chart on the spot again.
    await page.goBack();
    await expect(page).toHaveURL(/\/\?spot=brandon$/);
    await expect(barName(page)).toHaveText("Brandon Bay");
  });

  test("the locate button lists the spots round the rider, the heart turned off; the chart beside it shows the rider as a blue dot", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation(DUBLIN);
    await openHome(page, ["brandon"]);
    await expect(heart(page)).toHaveAttribute("aria-pressed", "true");
    await locate(page).click();
    await expect(heart(page)).toHaveAttribute("aria-pressed", "false");
    await expect(cards(page).filter({ hasText: "Dollymount" })).toHaveCount(1, {
      timeout: 30000,
    });
    await expect.poll(() => pills(page).count()).toBe(await seen(page));
    await expect(
      page.locator('.spot-marker[data-spot-id="brandon"]'),
    ).toHaveClass(/\blt-bead\b/);
    await expect(page.getByRole("img", { name: "You are here" })).toBeVisible();
  });
});

test.describe("a first visit, with no favourites", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("no question on a first visit; the locate button lists the spots round the rider, and the chart beside it opens round them, with the blue dot", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation(DUBLIN);
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
    await page.goto("/");
    await expect(finder(page)).toHaveAttribute("data-scope", "near");
    await expect(heart(page)).toHaveAttribute("aria-pressed", "false");
    await expect(cards(page).first()).toBeVisible({ timeout: 30000 });
    expect(
      await page.evaluate(() => (window as unknown as { asked: number }).asked),
    ).toBe(0);
    await locate(page).click();
    await expect(cards(page).filter({ hasText: "Dollymount" })).toHaveCount(1, {
      timeout: 30000,
    });
    await expect(page.getByRole("img", { name: "You are here" })).toBeVisible();
    // Opened round the rider: their mark in the middle of the box beside it,
    // the list what is in view, and the spots further out a pan away.
    const box = (await panel(page).boundingBox())!;
    await expect
      .poll(async () => {
        const you = await page
          .getByRole("img", { name: "You are here" })
          .boundingBox();
        return you
          ? Math.abs(you.x + you.width / 2 - (box.x + box.width / 2))
          : Infinity;
      })
      .toBeLessThan(box.width / 3);
    await expect.poll(() => cards(page).count()).toBeLessThan(30);
    // A pill for each card the rider can see, each on the map.
    const shown = await seen(page);
    await expect(pills(page)).toHaveCount(shown, { timeout: 30000 });
    await expect.poll(() => pillsInside(page)).toBe(shown);
  });

  test("location not known: the chart opens fitted to the spots nearest the middle of Ireland, once, and the list then is what it shows", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(finder(page)).toHaveAttribute("data-scope", "near");
    await expect(cards(page).first()).toBeVisible({ timeout: 30000 });
    await expect(pills(page).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("img", { name: "You are here" })).toHaveCount(
      0,
    );
    // The list comes to what the fit shows, and it holds: no second fit.
    await expect
      .poll(async () => (await seen(page)) === (await pillsInside(page)))
      .toBe(true);
    const settled = await headIds(page);
    const camera = await page.evaluate(
      () => document.querySelector(".map-canvas")?.className,
    );
    await page.waitForTimeout(1500);
    expect(await headIds(page)).toEqual(settled);
    expect(
      await page.evaluate(
        () => document.querySelector(".map-canvas")?.className,
      ),
    ).toBe(camera);
  });
});

/** How many spots the map shows, as the note after a capped list says. */
const inView = async (page: Page) =>
  Number(
    /(\d+) spots in view/.exec(
      (await page
        .locator("[data-finder-more]")
        .textContent({ timeout: 1000 })
        .catch(() => "")) ?? "",
    )?.[1] ?? NaN,
  );
const headIds = (page: Page) =>
  cards(page).evaluateAll((els) =>
    els.map((el) => (el as HTMLElement).dataset.spotCard),
  );
const button = (page: Page, name: string) =>
  panel(page).getByRole("button", { name });

/** The chart at rest: no move on, and its list drawn from where it stopped. */
const rest = async (page: Page) => {
  await expect(page.locator(".map-lights.is-moving")).toHaveCount(0);
  await page.waitForTimeout(700);
  await expect(page.locator(".map-lights.is-moving")).toHaveCount(0);
};

/**
 * A place on the chart with no light on it, to take hold of the map: from its
 * right side for a drag to the left, so the pointer stays in the window.
 */
const openWater = (page: Page, fromRight = false) =>
  page.evaluate((fromRight) => {
    const box = document.querySelector(".map-panel")!.getBoundingClientRect();
    for (let y = box.top + 150; y < box.bottom - 80; y += 40)
      for (let k = 80; k < box.width - 80; k += 40) {
        const x = fromRight ? box.right - k : box.left + k;
        if (document.elementFromPoint(x, y)?.closest(".maplibregl-canvas"))
          return { x, y };
      }
    throw new Error("no room on the chart");
  }, fromRight);

/** The chart dragged by this much, the button held until `held` has looked. */
async function drag(
  page: Page,
  dx: number,
  dy: number,
  held?: () => Promise<void>,
) {
  const at = await openWater(page, dx < 0);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + dx / 2, at.y + dy / 2, { steps: 5 });
  await page.mouse.move(at.x + dx, at.y + dy, { steps: 5 });
  await held?.();
  await page.mouse.up();
  await rest(page);
}

/**
 * A bead clear of every other mark, inside the chart: its id and place. With
 * `listed`, one whose card is on the list (out of view, so not a pill); with
 * false, one the list has no card for.
 */
const freeBead = (page: Page, listed: boolean) =>
  page.evaluate((listed) => {
    const box = document.querySelector(".map-panel")!.getBoundingClientRect();
    for (const el of document.querySelectorAll<HTMLElement>(
      ".spot-marker.lt-bead:not(.lt-under)",
    )) {
      const id = el.dataset.spotId!;
      const card = document.querySelector(`[data-spot-card="${id}"]`);
      if (!!card !== listed) continue;
      // Listed, its card out of the list's view altogether.
      const list = document
        .querySelector("[data-finder-list]")!
        .getBoundingClientRect();
      const c = card?.getBoundingClientRect();
      if (c && c.bottom > list.top && c.top < list.bottom) continue;
      const r = el.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      // No other spot within a few pixels: two that close tie for nearest.
      const twin = [
        ...document.querySelectorAll<HTMLElement>(".spot-marker"),
      ].some((other) => {
        if (other === el) return false;
        const o = other.getBoundingClientRect();
        return Math.hypot(o.x + o.width / 2 - x, o.y + o.height / 2 - y) < 5;
      });
      if (
        !twin &&
        x > box.left + 130 &&
        x < box.right - 130 &&
        y > box.top + 150 &&
        y < box.bottom - 80 &&
        // A bead under the point: the nearest is the one meant, and that
        // is this one.
        document.elementFromPoint(x, y)?.closest(".spot-marker.lt-bead")
      )
        return { id, x, y };
    }
    throw new Error("no bead to reach");
  }, listed);

/** The heart off on the whole of the chart, every spot in view, the first visit's. */
async function wholeChart(page: Page) {
  await page.goto("/");
  await expect(cards(page).first()).toBeVisible({ timeout: 30000 });
  await expect(lights(page)).toHaveCount(149, { timeout: 30000 });
  for (let i = 0; i < 4; i++) {
    await button(page, "Zoom out").click();
    await rest(page);
  }
  await expect.poll(() => inView(page), { timeout: 30000 }).toBe(149);
}

test.describe("with the heart off, the list follows the map beside it", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("a pan to another part of the country lists the spots there, once the camera settles, with no location set", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(cards(page).first()).toBeVisible({ timeout: 30000 });
    await expect(lights(page)).toHaveCount(149, { timeout: 30000 });
    await rest(page);
    await expect
      .poll(async () => (await seen(page)) === (await pillsInside(page)))
      .toBe(true);
    const before = await headIds(page);
    expect(before.length).toBeGreaterThan(0);
    const box = (await panel(page).boundingBox())!;
    // Held mid-pan, the list has not moved; let go, it has.
    await drag(page, -box.width * 0.8, 0, async () => {
      await page.waitForTimeout(300);
      expect(await headIds(page)).toEqual(before);
    });
    await expect.poll(() => headIds(page)).not.toEqual(before);
    // Each card a pill in view.
    await expect
      .poll(async () => (await seen(page)) === (await pillsInside(page)))
      .toBe(true);
    expect(await pills(page).count()).toBe(await seen(page));
    // No distances, and nothing asked of the browser.
    await expect(cards(page).filter({ hasText: / km · / })).toHaveCount(0);
  });

  test("the full chart and back leaves the map where it was, and no list is drawn for the chart's moves", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(cards(page).first()).toBeVisible({ timeout: 30000 });
    await expect(lights(page)).toHaveCount(149, { timeout: 30000 });
    await rest(page);
    const box = (await panel(page).boundingBox())!;
    await drag(page, -box.width / 2, 0);
    await expect
      .poll(async () => (await seen(page)) === (await pillsInside(page)))
      .toBe(true);
    const before = await headIds(page);
    await mapButton(page).click();
    await expect(onChart(page)).toBeVisible();
    await rest(page);
    expect(await headIds(page)).toEqual(before);
    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeVisible();
    await rest(page);
    await expect.poll(() => headIds(page)).toEqual(before);
  });

  test("the heart on keeps the rider's own list on a pan, and pressed fits the map to it", async ({
    page,
  }) => {
    await openHome(page);
    const before = await headIds(page);
    await drag(page, -300, 0);
    expect(await headIds(page)).toEqual(before);
    // A pill for each favourite whose spot is still in view.
    await expect(cards(page)).toHaveCount(3);
    await expect
      .poll(
        async () => (await pills(page).count()) === (await pillsInside(page)),
      )
      .toBe(true);
    // Off, the list is what the map shows; the favourites now off to one
    // side, pressed on again, the map is fitted to them.
    await heart(page).click();
    await expect(heart(page)).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => headIds(page)).not.toEqual(before);
    await drag(page, -400, 0);
    await heart(page).click();
    await expect(heart(page)).toHaveAttribute("aria-pressed", "true");
    await expect(cards(page)).toHaveCount(3);
    await expect.poll(() => pillsInside(page)).toBe(3);
  });

  test("over the cap: 30 cards led by each county's best, a quiet line with the true count, a pill for each card in view and beads for the rest", async ({
    page,
  }) => {
    await wholeChart(page);
    await expect(cards(page)).toHaveCount(30);
    await expect(page.locator("[data-finder-more]")).toHaveText(
      "149 spots in view, the best 30 here. Zoom in for the rest.",
    );
    const shown = await seen(page);
    expect(shown).toBeGreaterThan(2);
    expect(shown).toBeLessThan(30);
    await expect(pills(page)).toHaveCount(shown);
    await expect(beads(page)).toHaveCount(149 - shown);
    // The whole country is far wider than 180 km: the list leads with the
    // best spot in each county, so its first cards are each another county's.
    await expect(page.locator(".spot-marker.pending")).toHaveCount(0, {
      timeout: 30000,
    });
    const counties = await cards(page).evaluateAll((els) =>
      els.map((el) => /Co\. ([^·\n]+)/.exec(el.textContent ?? "")?.[1]?.trim()),
    );
    const lead = counties.slice(0, 6);
    expect(new Set(lead).size).toBe(lead.length);
  });

  test("open sea: says so, and zooming back out lists spots again", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(cards(page).first()).toBeVisible({ timeout: 30000 });
    await expect(lights(page)).toHaveCount(149, { timeout: 30000 });
    await button(page, "Zoom in").click();
    await button(page, "Zoom in").click();
    await rest(page);
    const empty = page.locator("[data-finder-empty]");
    for (let i = 0; i < 12 && !(await empty.count()); i++)
      await drag(page, 500, 0);
    await expect(empty).toHaveText(
      "No spots in this part of the map. Zoom out or move the map.",
    );
    await expect(cards(page)).toHaveCount(0);
    await expect(pills(page)).toHaveCount(0);
    for (let i = 0; i < 4; i++) {
      await button(page, "Zoom out").click();
      await rest(page);
    }
    await expect(empty).toHaveCount(0);
    await expect.poll(() => cards(page).count()).toBeGreaterThan(0);
  });

  test("a card under the pointer changes neither the list nor the map", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(cards(page).first()).toBeVisible({ timeout: 30000 });
    await expect(lights(page)).toHaveCount(149, { timeout: 30000 });
    await rest(page);
    await expect
      .poll(async () => (await seen(page)) === (await pillsInside(page)))
      .toBe(true);
    const before = await headIds(page);
    expect(before.length).toBeGreaterThan(3);
    for (const id of before.slice(0, 4)) {
      await page.locator(`[data-spot-card="${id}"]`).hover();
      await expect(
        page.locator(`.spot-marker[data-spot-id="${id}"]`),
      ).toHaveClass(/\blit\b/);
      // Longer than the wait before a Favourites card's pan.
      await page.waitForTimeout(300);
      await expect(page.locator(".map-lights.is-moving")).toHaveCount(0);
    }
    await rest(page);
    expect(await headIds(page)).toEqual(before);
  });

  test("a bead under the pointer is its light pill and outlines its card; no card opens over the map; the keys do the same", async ({
    page,
  }) => {
    await wholeChart(page);
    await expect(page.locator(".spot-marker.pending")).toHaveCount(0, {
      timeout: 30000,
    });
    // A bead whose card is on the list, out of the list's view.
    const bead = await freeBead(page, true);
    const light = page.locator(`.spot-marker[data-spot-id="${bead.id}"]`);
    await page.mouse.move(bead.x, bead.y);
    await expect(light).toHaveClass(/\blit\b/);
    await expect(light.locator(".lt-pill")).toBeVisible();
    await expect(light.locator(".lt-kn")).toHaveText(/^\d+$/);
    await expect(page.locator(`[data-spot-card="${bead.id}"]`)).toHaveAttribute(
      "data-lit",
      "",
    );
    await expect(page.locator("[data-spot-card][data-lit]")).toHaveCount(1);
    // No card over the map, and nothing else faded.
    await expect(page.locator(".map-card:not([hidden])")).toHaveCount(0);
    await expect(page.locator(".spot-marker:not(.lit)").first()).toHaveCSS(
      "opacity",
      "1",
    );
    await page.mouse.move(5, 5);
    await expect(light).not.toHaveClass(/\blit\b/);
    await expect(light.locator(".lt-pill")).toBeHidden();
    await expect(page.locator("[data-spot-card][data-lit]")).toHaveCount(0);
    // One the list has no card for: its light pill, no card outlined.
    const other = await freeBead(page, false);
    await page.mouse.move(other.x, other.y);
    await expect(
      page.locator(`.spot-marker[data-spot-id="${other.id}"]`),
    ).toHaveClass(/\blit\b/);
    await expect(page.locator("[data-spot-card][data-lit]")).toHaveCount(0);
    await page.mouse.move(5, 5);
    // The keys: the same light pill and outline.
    await light.focus();
    await expect(light).toHaveClass(/\blit\b/);
    await expect(page.locator(`[data-spot-card="${bead.id}"]`)).toHaveAttribute(
      "data-lit",
      "",
    );
    await expect(page.locator(".map-card:not([hidden])")).toHaveCount(0);
  });

  test("a bead pressed brings its card into view, or opens its spot's page where the list has none, and so does Enter", async ({
    page,
  }) => {
    await wholeChart(page);
    await expect(page.locator(".spot-marker.pending")).toHaveCount(0, {
      timeout: 30000,
    });
    const listed = await freeBead(page, true);
    await expect(
      page.locator(`[data-spot-card="${listed.id}"]`),
    ).not.toBeInViewport();
    await page.mouse.click(listed.x, listed.y);
    await expect(
      page.locator(`[data-spot-card="${listed.id}"]`),
    ).toBeInViewport();
    await expect(page).toHaveURL(/\/$/);
    const bead = await freeBead(page, false);
    await page.mouse.click(bead.x, bead.y);
    await expect(page).toHaveURL(new RegExp(`/spot/${bead.id}`));
    await page.goBack();
    await expect(cards(page).first()).toBeVisible({ timeout: 30000 });
    await expect(lights(page)).toHaveCount(149, { timeout: 30000 });
    await expect(beads(page).first()).toBeAttached({ timeout: 30000 });
    const again = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".spot-marker.lt-bead")]
        .map((el) => el.dataset.spotId!)
        .find((id) => !document.querySelector(`[data-spot-card="${id}"]`))!,
    );
    await page.locator(`.spot-marker[data-spot-id="${again}"]`).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/spot/${again}`));
  });

  test("a pill pressed with the heart off opens its spot's page", async ({
    page,
  }) => {
    await wholeChart(page);
    const first = await pills(page).first().getAttribute("data-spot-id");
    await expect(page).toHaveURL(/\/$/);
    await page
      .locator(`.spot-marker[data-spot-id="${first}"]`)
      .dispatchEvent("click", { detail: 1 });
    await expect(page).toHaveURL(new RegExp(`/spot/${first}`));
  });
});

test.describe("a bead under a finger, beside the list", () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: true });

  test("a tap brings its card into view, with no card over the map", async ({
    page,
  }) => {
    await wholeChart(page);
    const bead = await freeBead(page, true);
    await page.touchscreen.tap(bead.x, bead.y);
    await expect(
      page.locator(`[data-spot-card="${bead.id}"]`),
    ).toBeInViewport();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(".map-card:not([hidden])")).toHaveCount(0);
  });
});

test.describe("under the width for the chart beside the list", () => {
  test.use({ viewport: { width: 900, height: 860 } });

  test("with the heart off, the list is the spots nearest the middle of Ireland, with no map to follow", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(cards(page)).toHaveCount(12, { timeout: 30000 });
    await page.waitForTimeout(1500);
    await expect(cards(page)).toHaveCount(12);
    await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
    await expect(page.locator("[data-finder-more]")).toHaveCount(0);
  });

  test("the list alone, and the bar's Chart to the full chart, which is Spots there", async ({
    page,
  }) => {
    await star(page, ["brandon", "keel"]);
    await page.goto("/");
    await expect(cards(page)).toHaveCount(2, { timeout: 30000 });
    await expect(panel(page)).toHaveCount(0);
    await mapButton(page).click();
    await expect(page).toHaveURL(/\/\?map$/);
    await expect(lights(page)).toHaveCount(149, { timeout: 30000 });
    await expect(onChart(page)).toBeVisible();
    // No collapse here: there is no panel to collapse to.
    await expect(
      page.getByRole("button", { name: "Back to the list" }),
    ).toHaveCount(0);
    await listButton(page).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(mapButton(page)).toBeVisible();
  });
});

test.describe("on a phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test("the map is made the first time Chart is pressed, and kept; the chart keeps its zoom and Layers", async ({
    page,
  }) => {
    await star(page, ["brandon", "keel"]);
    await page.goto("/");
    await expect(cards(page)).toHaveCount(2, { timeout: 30000 });
    await page.waitForTimeout(1500);
    await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
    await mapButton(page).tap();
    await expect(page.locator(".maplibregl-canvas")).toHaveCount(1, {
      timeout: 30000,
    });
    await expect(lights(page)).toHaveCount(149, { timeout: 30000 });
    await mark(page);
    const controls = page.getByRole("group", { name: "Map controls" });
    for (const name of ["Zoom in", "Zoom out", "Layers"])
      await expect(controls.getByRole("button", { name })).toBeVisible();
    // The controls start under the bar, not under its 56px.
    const top = (await bar(page).boundingBox())!;
    const zoom = (await controls.boundingBox())!;
    expect(zoom.y).toBeGreaterThanOrEqual(top.y + top.height);
    // A spot: its week in the scrub bar; the top bar's Spots back to the list.
    await page
      .locator('.spot-marker[data-spot-id="brandon"]')
      .dispatchEvent("click");
    await expect(barName(page)).toHaveText("Brandon Bay", {
      timeout: 30000,
    });
    await listButton(page).tap();
    await expect(page).toHaveURL(/\/$/);
    await expect(cards(page)).toHaveCount(2);
    await expect(scrubBar(page)).toHaveCount(0);
    // Kept, out of sight, for the next time.
    expect(await kept(page)).toBe(true);
    await mapButton(page).tap();
    await expect(onChart(page)).toBeVisible();
    expect(await kept(page)).toBe(true);
  });
});
