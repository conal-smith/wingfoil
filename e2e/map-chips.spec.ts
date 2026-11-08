import {
  FIELD_KEY,
  expect,
  fieldChip,
  fieldChips,
  layersRail,
  mapDock,
  openFromMenu,
  test,
  type Page,
} from "./fixtures";
import { SAMPLE_CLOCK } from "./columns";
import { readSample } from "./sample";

/**
 * The map's field, chosen with the lit chips in its dock (src/MapDock.tsx,
 * force5/src/mapField.ts): Wind or Weather (Waves once there are wave frames
 * for the map), at most one on, the one on pressed again for none, which is
 * the plain map with the shallows glowing. The same choice on the finder's
 * map and on the full chart, kept on the device, none too. Beside the list
 * the dock has the day's hour bar, which shares the cards' hour.
 */

const harmonie = readSample("harmonie");
/** The finder in the afternoon, so today has hours to scrub. */
const AFTERNOON = new Date(SAMPLE_CLOCK.getTime() - 7.5 * 3600000);

const legend = (page: Page) => mapDock(page).locator("[data-map-legend]");
const pressed = (page: Page) =>
  fieldChips(page)
    .getByRole("button")
    .evaluateAll((chips) =>
      chips
        .filter((chip) => chip.getAttribute("aria-pressed") === "true")
        .map((chip) => chip.textContent),
    );
const hourTrack = (page: Page) =>
  mapDock(page).getByRole("slider", { name: "Hour" });
const panelWhen = (page: Page) => page.locator("[data-panel-when]");

/** The finder beside its map, the map up. */
async function openFinder(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.setFixedTime(AFTERNOON);
  await page.goto("/");
  await expect(page.locator("[data-spot-finder]")).toBeVisible({
    timeout: 30000,
  });
  await expect(mapDock(page)).toBeVisible({ timeout: 30000 });
}

/** The wind tiles' lead hours the page asks for (force5/src/tiledField.ts). */
function windHoursAsked(page: Page) {
  const asked = new Set<number>();
  page.on("request", (request) => {
    const found =
      /\/weather\/harmonie-[^/]+\/t\/\d+\/\d+\/\d+\/(\d+)\.bin$/.exec(
        new URL(request.url()).pathname,
      );
    if (found) asked.add(Number(found[1]));
  });
  return asked;
}

test("beside the list: Wind and Weather, none on at first, one at a time, and the one on pressed again for none", async ({
  page,
}) => {
  await openFinder(page);
  // No wave frames for the map yet: no Waves chip.
  await expect(fieldChips(page).getByRole("button")).toHaveText([
    "Wind",
    "Weather",
  ]);
  await expect(fieldChip(page, "Waves")).toHaveCount(0);
  // A first visit: none on, the shallows' legend.
  expect(await pressed(page)).toEqual([]);
  for (const name of ["Wind", "Weather"] as const)
    await expect(fieldChip(page, name)).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  await expect(legend(page)).toHaveAttribute("data-map-legend", "none");
  await expect(legend(page)).toHaveText("Shallow water");
  const canvas = page.locator(".particle-canvas");
  await expect(canvas).toHaveAttribute("data-wind", "");

  // Wind: the coloured wind, and its ramp in the legend.
  await fieldChip(page, "Wind").click();
  expect(await pressed(page)).toEqual(["Wind"]);
  await expect(legend(page)).toHaveAttribute("data-map-legend", "wind");
  await expect(legend(page)).toContainText("Knots");
  await expect(canvas).toHaveAttribute("data-wind", "wash");
  // Lit: it glows, a fill and an edge, not the soft chip's ink.
  const lit = await fieldChip(page, "Wind").evaluate((el) => {
    const style = getComputedStyle(el);
    return [style.backgroundColor, style.borderTopColor];
  });
  for (const colour of lit) expect(colour).not.toMatch(/^rgba\(0, 0, 0, 0\)$/);

  // Weather in its place: one at a time.
  await fieldChip(page, "Weather").click();
  expect(await pressed(page)).toEqual(["Weather"]);
  await expect(legend(page)).toHaveAttribute("data-map-legend", "weather");
  await expect(canvas).toHaveAttribute("data-wind", "");

  // Pressed again: none, and the shallows back.
  await fieldChip(page, "Weather").click();
  expect(await pressed(page)).toEqual([]);
  await expect(legend(page)).toHaveText("Shallow water");
  // Off, the chip is a ghost: no fill and no edge, once the pointer has left
  // it (under the pointer it takes a faint fill).
  await page.mouse.move(10, 10);
  await expect
    .poll(() =>
      fieldChip(page, "Weather").evaluate((el) => {
        const style = getComputedStyle(el);
        return [style.backgroundColor, style.borderTopColor];
      }),
    )
    .toEqual(["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"]);
});

test("the chips are one stop on Tab: the arrows walk them, Space and Enter press, Escape turns the field off", async ({
  page,
}) => {
  await openFinder(page);
  const wind = fieldChip(page, "Wind");
  const weather = fieldChip(page, "Weather");
  // One stop: the first chip with none on.
  await expect(wind).toHaveAttribute("tabindex", "0");
  await expect(weather).toHaveAttribute("tabindex", "-1");
  await wind.focus();
  await page.keyboard.press("ArrowRight");
  await expect(weather).toBeFocused();
  // Round from the end to the start, and Home and End.
  await page.keyboard.press("ArrowRight");
  await expect(wind).toBeFocused();
  await page.keyboard.press("End");
  await expect(weather).toBeFocused();
  await page.keyboard.press("Home");
  await expect(wind).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(weather).toBeFocused();
  // Space presses the chip with the focus; Enter another, in its place.
  await page.keyboard.press("Space");
  await expect(weather).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowRight");
  await expect(wind).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(wind).toHaveAttribute("aria-pressed", "true");
  await expect(weather).toHaveAttribute("aria-pressed", "false");
  // Escape: none, the focus where it was.
  await page.keyboard.press("Escape");
  await expect(wind).toHaveAttribute("aria-pressed", "false");
  await expect(weather).toHaveAttribute("aria-pressed", "false");
  await expect(wind).toBeFocused();
  // Tab leaves the group, and Shift+Tab comes back to the chip it left.
  await page.keyboard.press("Tab");
  expect(
    await fieldChips(page).evaluate((el) =>
      el.contains(document.activeElement),
    ),
  ).toBe(false);
  await page.keyboard.press("Shift+Tab");
  await expect(wind).toBeFocused();
});

test("the choice is kept on the device, none too, and is the full chart's as well", async ({
  page,
}) => {
  await openFinder(page);
  await fieldChip(page, "Weather").click();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), FIELD_KEY),
  ).toBe("weather");
  await page.reload();
  await expect(fieldChip(page, "Weather")).toHaveAttribute(
    "aria-pressed",
    "true",
    { timeout: 30000 },
  );
  // The full chart: the same field, its dock over the week bar, the chips
  // and the legend alone, and no Coloured wind, Tidal depth or Rain in the
  // rail.
  await page.goto("/?spot=brandon");
  await expect(mapDock(page)).toHaveAttribute("data-map-dock", "chart");
  await expect(fieldChip(page, "Weather")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(mapDock(page).getByRole("slider")).toHaveCount(0);
  const dock = (await mapDock(page).boundingBox())!;
  const bar = (await page.locator(".scrub").boundingBox())!;
  expect(dock.y + dock.height).toBeLessThanOrEqual(bar.y);
  await openFromMenu(page, "Layers");
  for (const name of ["Coloured wind", "Tidal depth", "Rain"])
    await expect(
      layersRail(page).getByRole("button", { name, exact: true }),
    ).toHaveCount(0);
  // None, kept as none.
  await fieldChip(page, "Weather").click();
  await page.reload();
  await expect(legend(page)).toHaveText("Shallow water", { timeout: 30000 });
  expect(
    await page.evaluate((key) => localStorage.getItem(key), FIELD_KEY),
  ).toBe("none");
  // A rider whose stored wind had the colour on, and no field yet, starts on
  // Wind.
  await page.evaluate((key) => {
    localStorage.removeItem(key);
    localStorage.setItem(
      "wingfoil.map.wind.v2",
      JSON.stringify({ wash: true, particles: true }),
    );
  }, FIELD_KEY);
  await page.reload();
  await expect(fieldChip(page, "Wind")).toHaveAttribute(
    "aria-pressed",
    "true",
    {
      timeout: 30000,
    },
  );
});

test("beside the list the hour bar scrubs the list's day, sharing its hour with the cards, and with Wind on the map reads that hour's wind", async ({
  page,
}) => {
  await page.addInitScript(
    (key) => localStorage.setItem(key, "wind"),
    FIELD_KEY,
  );
  const asked = windHoursAsked(page);
  await openFinder(page);
  const track = hourTrack(page);
  await expect(track).toHaveAttribute("aria-valuemin", "6");
  await expect(track).toHaveAttribute("aria-valuemax", "21");
  await expect(track).toHaveAttribute("aria-valuetext", /^Today \d\d:00$/);
  await expect(panelWhen(page)).toHaveText(/^Stars at \d\d:00 today$/);
  const start = Number(await track.getAttribute("aria-valuenow"));
  // The keys step it an hour, and the cards and the lights go with it.
  await track.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const hour = String(start + 2).padStart(2, "0");
  await expect(track).toHaveAttribute("aria-valuenow", String(start + 2));
  await expect(track).toHaveAttribute("aria-valuetext", `Today ${hour}:00`);
  await expect(mapDock(page).locator("[data-hour-when]")).toHaveText(
    `Today ${hour}:00`,
  );
  await expect(panelWhen(page)).toHaveText(`Stars at ${hour}:00 today`);
  await expect(page.locator("[data-picked-hour]").first()).toBeAttached();
  // The wind tiles of that hour (Irish summer time is an hour ahead).
  const day = await mapDock(page)
    .locator("[data-hour-bar]")
    .getAttribute("data-day");
  const lead =
    (Date.parse(`${day}T${String(start + 2 - 1).padStart(2, "0")}:00:00Z`) -
      Date.parse(harmonie.runTime)) /
    3600000;
  await expect.poll(() => asked.has(lead), { timeout: 20000 }).toBe(true);

  // A press on a card's bars moves the bar too: one hour, both ways.
  const bar = page
    .locator("[data-spot-card]")
    .nth(0)
    .locator('[data-bar="wind"]');
  const box = (await bar.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.9, box.y + box.height / 2);
  const picked = (await panelWhen(page).textContent())!.slice(9, 14);
  await expect(track).toHaveAttribute("aria-valuetext", `Today ${picked}`);

  // A drag along the track picks the hour under it, the last one at its end.
  const t = (await track.boundingBox())!;
  await page.mouse.click(t.x + t.width - 1, t.y + 8);
  await expect(track).toHaveAttribute("aria-valuenow", "21");
  await expect(track).toHaveAttribute("aria-valuetext", "Today 21:00");
});

test("with no field on, a scrub of the hour bar reads no wind for the map", async ({
  page,
}) => {
  const asked = windHoursAsked(page);
  await openFinder(page);
  await expect(legend(page)).toHaveText("Shallow water");
  await page.waitForTimeout(1500);
  const before = new Set(asked);
  await hourTrack(page).focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1500);
  expect([...asked].filter((hour) => !before.has(hour))).toEqual([]);
});

test.describe("on a phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test("the chips share the dock's width over the week bar, with no legend", async ({
    page,
  }) => {
    await page.goto("/?spot=brandon");
    await expect(mapDock(page)).toBeVisible({ timeout: 30000 });
    await expect(legend(page)).toHaveCount(0);
    const dock = (await mapDock(page).boundingBox())!;
    expect(dock.width).toBeGreaterThan(360);
    const wind = (await fieldChip(page, "Wind").boundingBox())!;
    const weather = (await fieldChip(page, "Weather").boundingBox())!;
    expect(Math.abs(wind.width - weather.width)).toBeLessThan(2);
    expect(wind.width).toBeGreaterThan(150);
    await fieldChip(page, "Weather").tap();
    await expect(fieldChip(page, "Weather")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Clear of the small print, which stands over it.
    const print = (await page
      .getByRole("button", { name: "Sources and small print" })
      .boundingBox())!;
    expect(print.y + print.height).toBeLessThanOrEqual(dock.y);
  });
});
