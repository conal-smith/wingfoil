import {
  FIELD_KEY,
  expect,
  barReady,
  fieldChip,
  mapDock,
  openFromMenu,
  setField,
  test,
  timeSlider,
  type Page,
} from "./fixtures";
import { sampleStrip } from "./columns";

/**
 * The Weather field over the chart: the sky, grey cloud and yellow clear sky,
 * black where the sun is down, with the hour's rain over it (off at first,
 * and then nothing of it is read, neither its frames nor its code),
 * following the scrub bar's hour. A spot's rain hour by hour is on its page. The e2e site's ICON-EU
 * weather is an hourly run from HARMONIE's sample day for three days
 * (scripts/sample-weather.mjs), with a frame of rain an hour.
 */

const FRAMES = /\/weather\/icon-eu-weather-[^/]+\/frames\/\d{3}\.json$/;
const CODE = /(rainData|skyLayer|sky)[^/]*\.(js|ts)$/;

function watch(page: Page) {
  const asked: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (FRAMES.test(path) || CODE.test(path)) asked.push(path);
  });
  return asked;
}

const slider = timeSlider;
const map = (page: Page) => page.locator(".map-canvas");

/** The hour the map shows, as the rain layer must have it. */
async function shownHour(page: Page) {
  const at = Number(await slider(page).inputValue());
  return new Date(sampleStrip[at].time).toISOString();
}

test("the rain layer is off at first and nothing of it is loaded", async ({
  page,
}) => {
  const asked = watch(page);
  await page.goto("/?map");
  await expect(page.locator(".spot-marker").first()).toBeVisible({
    timeout: 30000,
  });
  await expect(fieldChip(page, "Weather")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.waitForTimeout(500);
  expect(asked).toEqual([]);
  await expect(map(page)).not.toHaveAttribute("data-rain", /./);
});

test("turned on, it draws the hour shown under the chart's ink, and follows the hour", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const asked = watch(page);
  await page.goto("/?spot=brandon");
  await barReady(page);
  await setField(page, "Weather", true);
  // The legend at the dock's right is the sky's ramp and the rain's now.
  const legend = mapDock(page).locator('[data-map-legend="weather"]');
  await expect(legend).toBeVisible();
  await expect(legend).toContainText("Sky");
  await expect(legend).toContainText("Rain");

  // The hour shown, read from its own frame: one hour's rain, under the relief.
  await expect(map(page)).toHaveAttribute(
    "data-rain-to",
    await shownHour(page),
    {
      timeout: 20000,
    },
  );
  await expect(map(page)).toHaveAttribute("data-rain-under", "relief");
  // The e2e site's frames carry the cloud: the sky is drawn, the rain over it.
  await expect(map(page)).toHaveAttribute("data-sky", "cloud");
  const to = Date.parse((await map(page).getAttribute("data-rain-to"))!);
  const from = Date.parse((await map(page).getAttribute("data-rain-from"))!);
  expect(to - from).toBe(3600000);
  expect(asked.some((path) => FRAMES.test(path))).toBe(true);

  // A step on in time is the next hour's rain.
  await slider(page).focus();
  await page.keyboard.press("ArrowRight");
  await expect(map(page)).toHaveAttribute(
    "data-rain-to",
    await shownHour(page),
  );

  expect(
    await page.evaluate((key) => localStorage.getItem(key), FIELD_KEY),
  ).toBe("weather");

  // Off again: nothing drawn, and the shallows' legend back.
  await setField(page, "Weather", false);
  await expect(mapDock(page).locator('[data-map-legend="none"]')).toBeVisible();
  await expect(map(page)).not.toHaveAttribute("data-rain", /./);
  expect(errors).toEqual([]);
});

test("its part of About the map says what the hour shows", async ({ page }) => {
  await page.addInitScript(
    (key) => localStorage.setItem(key, "weather"),
    FIELD_KEY,
  );
  await page.goto("/?map");
  await expect(page.locator(".spot-marker").first()).toBeVisible({
    timeout: 30000,
  });
  await openFromMenu(page, "About the map");
  await page.getByRole("tab", { name: "Weather" }).click();
  const part = page.locator("#map-info-rain");
  await expect(part).toBeVisible();
  await expect(part.locator("[data-rain-key]")).toBeVisible();
  await expect(part.locator("[data-rain-line]")).toHaveText(
    /^Shown: the rain [A-Z][a-z]{2} \d\d:\d\d to \d\d:\d\d\.$/,
    { timeout: 20000 },
  );
});

test("with no rain published the page still works, and says so", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/weather/icon-eu-weather.json", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await page.addInitScript(
    (key) => localStorage.setItem(key, "weather"),
    FIELD_KEY,
  );
  await page.goto("/?map");
  await expect(page.locator(".spot-marker").first()).toBeVisible({
    timeout: 30000,
  });
  await openFromMenu(page, "About the map");
  await page.getByRole("tab", { name: "Weather" }).click();
  await expect(page.locator("[data-rain-line]")).toHaveText(
    "No rain forecast is published just now.",
    { timeout: 20000 },
  );
  await expect(map(page)).not.toHaveAttribute("data-rain", /./);
  expect(errors).toEqual([]);
});
