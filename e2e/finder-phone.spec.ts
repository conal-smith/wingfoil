import { expect, test, type Page } from "./fixtures";
import { SAMPLE_CLOCK } from "./columns";

/**
 * The finder under the width for the list beside the map (src/App.tsx
 * `narrow`): Map | List, the map first. On the map the best five spots in
 * view are pills and the rest beads; a pill tapped turns light and opens its
 * peek above the dock, a second tap opens the spot; a tap among close spots
 * asks which ("Spots here"); a spot found by the search is flown to and
 * peeked.
 */
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

const AFTERNOON = new Date(SAMPLE_CLOCK.getTime() - 7.5 * 3600000);

const foot = (page: Page) => page.locator("[data-narrow-foot]");
const switchTo = (page: Page, name: "Map" | "List") =>
  page
    .getByRole("group", { name: "Map or list" })
    .getByRole("button", { name });
const pills = (page: Page) => page.locator(".spot-marker.lt-pilled");
const peek = (page: Page) => page.locator("[data-spot-peek]");

/** The ids of the spots with a pill, in no order. */
const pilled = (page: Page) =>
  pills(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-spot-id")!).sort(),
  );

async function openMap(page: Page) {
  await page.clock.setFixedTime(AFTERNOON);
  await page.goto("/");
  await expect(page.locator(".spot-marker")).toHaveCount(149, {
    timeout: 30000,
  });
  await expect(page.locator(".spot-marker.pending")).toHaveCount(0, {
    timeout: 30000,
  });
  await expect(page.locator(".map-lights.is-moving")).toHaveCount(0);
  await expect
    .poll(() => pills(page).count(), { timeout: 30000 })
    .toBeGreaterThan(0);
}

test("the map opens first, then the list, the switch and the chips standing still", async ({
  page,
}) => {
  await openMap(page);
  await expect(foot(page)).toHaveAttribute("data-narrow-foot", "map");
  await expect(switchTo(page, "Map")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  // The dock: the day and its hours, then the chips the screen's width; no
  // legend, no zoom buttons, and the map's own locate button.
  const hours = foot(page).locator("[data-hour-bar]");
  await expect(hours).toBeVisible();
  await expect(
    hours.getByRole("button", { name: "The day after" }),
  ).toBeVisible();
  const chips = foot(page).locator("[data-map-field]");
  expect(await chips.count()).toBeGreaterThanOrEqual(2);
  const chipBox = (await chips.first().boundingBox())!;
  const hourBox = (await hours.boundingBox())!;
  expect(hourBox.y).toBeLessThan(chipBox.y);
  await expect(page.locator(".map-legend")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Zoom in" })).toHaveCount(0);
  await expect(
    foot(page).getByRole("button", { name: "Use my location" }),
  ).toBeVisible();
  await expect(page.locator("[data-spot-finder]")).toBeHidden();

  // The best five in view at most; the rest beads.
  const n = await pills(page).count();
  expect(n).toBeLessThanOrEqual(5);
  expect(await page.locator(".spot-marker.lt-bead").count()).toBeGreaterThan(
    100,
  );
  // Held through a scrub of the hours.
  const before = await pilled(page);
  await foot(page).locator("[data-hour-track]").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(600);
  expect(await pilled(page)).toEqual(before);

  // The list: the head and the cards; the switch and the chips stay where
  // they were, and the hours go, the cards having them.
  const switchBox = (await switchTo(page, "List").boundingBox())!;
  await switchTo(page, "List").tap();
  await expect(foot(page)).toHaveAttribute("data-narrow-foot", "list");
  await expect(page.locator("[data-spot-card]").first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator("[data-finder-heart]")).toBeVisible();
  await expect(foot(page).locator("[data-hour-bar]")).toHaveCount(0);
  const chipAfter = (await chips.first().boundingBox())!;
  expect(Math.abs(chipAfter.y - chipBox.y)).toBeLessThan(2);
  const switchAfter = (await switchTo(page, "List").boundingBox())!;
  expect(switchAfter.y).toBeGreaterThan(chipAfter.y - 120);
  expect(switchAfter.y).toBeLessThan(chipAfter.y);
  expect(Math.abs(switchAfter.x - switchBox.x)).toBeLessThan(2);
  // The heart off, the list is the spots the map showed.
  expect(await page.locator("[data-spot-card]").count()).toBeLessThanOrEqual(
    30,
  );
  await switchTo(page, "Map").tap();
  await expect(foot(page)).toHaveAttribute("data-narrow-foot", "map");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
});

test("a pill tapped turns light and peeks; tapped again it opens its spot", async ({
  page,
}) => {
  await openMap(page);
  const pill = pills(page).first();
  const id = (await pill.getAttribute("data-spot-id"))!;
  await pill.locator(".lt-pill").tap();
  await expect(peek(page)).toHaveAttribute("data-spot-peek", id);
  await expect(
    page.locator(`.spot-marker.sel[data-spot-id="${id}"]`),
  ).toHaveCount(1);
  for (const row of ["Wind", "Waves", "Weather", "Tide"])
    await expect(peek(page).getByText(row, { exact: true })).toBeVisible();
  // Above the dock and the switch, and on the screen.
  const box = (await peek(page).boundingBox())!;
  const switchBox = (await switchTo(page, "Map").boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(switchBox.y);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  // Tapped again, a moment on, its spot.
  await page.waitForTimeout(500);
  await page.locator(`.spot-marker[data-spot-id="${id}"] .lt-pill`).tap();
  await expect(page).toHaveURL(new RegExp(`/spot/${id}`), { timeout: 30000 });
});

test("a tap among close spots asks which: Spots here, 44 px rows", async ({
  page,
}) => {
  await openMap(page);
  // Two beads within a bead's reach of each other, neither under a pill.
  const at = await page.evaluate(() => {
    const beads = [
      ...document.querySelectorAll<HTMLElement>(".spot-marker.lt-bead"),
    ]
      .filter((el) => !el.classList.contains("lt-under"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          id: el.dataset.spotId!,
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
        };
      })
      .filter((b) => b.y > 80 && b.y < 560 && b.x > 20 && b.x < 370);
    for (const a of beads)
      for (const b of beads)
        if (a !== b && Math.hypot(a.x - b.x, a.y - b.y) < 14)
          return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return null;
  });
  expect(at).not.toBeNull();
  await page.touchscreen.tap(at!.x, at!.y);
  const here = page.getByRole("dialog", { name: "Spots here" });
  await expect(here).toBeVisible();
  const rows = here.locator("[data-spots-here-row]");
  expect(await rows.count()).toBeGreaterThanOrEqual(2);
  expect((await rows.first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const chosen = (await rows.first().getAttribute("data-spots-here-row"))!;
  await rows.first().tap();
  await expect(here).toHaveCount(0);
  await expect(peek(page)).toHaveAttribute("data-spot-peek", chosen);
});

test("a spot found by the search is flown to, its pill light, its peek open", async ({
  page,
}) => {
  await openMap(page);
  await page
    .locator("[data-top-bar]")
    .getByRole("button", { name: "Search spots" })
    .tap();
  await page.getByRole("combobox", { name: "Search spots" }).fill("keel");
  await page
    .getByRole("listbox", { name: "Spots" })
    .getByRole("option")
    .first()
    .tap();
  await expect(peek(page)).toHaveAttribute("data-spot-peek", "keel");
  await expect(
    page.locator('.spot-marker.sel.lt-pilled[data-spot-id="keel"]'),
  ).toHaveCount(1, { timeout: 30000 });
  await expect(
    page.locator('.spot-marker[data-spot-id="keel"]'),
  ).toBeInViewport();
  expect(new URL(page.url()).pathname).toBe("/");
});
