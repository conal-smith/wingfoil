import {
  chooseSpot,
  expect,
  scrubBar,
  test,
  timeSlider,
  type Page,
} from "./fixtures";
import { SAMPLE_CLOCK } from "./columns";

/**
 * The strip of hours a finger scrubs (src/TimeStrip.tsx), on a phone: under
 * the map's chips on the finder's map, and in the chart's scrub bar. About
 * eight hours across, a notch for every hour, the playhead still in the
 * middle; the browser's own scroll carries the hours under it, following
 * the finger frame by frame, and comes to rest on an hour.
 */
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

const AFTERNOON = new Date(SAMPLE_CLOCK.getTime() - 7.5 * 3600000);

const foot = (page: Page) => page.locator("[data-narrow-foot]");

async function openMap(page: Page) {
  await page.clock.setFixedTime(AFTERNOON);
  await page.goto("/");
  await expect(page.locator(".spot-marker")).toHaveCount(149, {
    timeout: 30000,
  });
  await expect(foot(page).locator("[data-time-strip]")).toBeVisible();
}

/** The notches whose middle is in the strip's view. */
const notchesInView = (scroller: ReturnType<Page["locator"]>) =>
  scroller.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return [...el.querySelectorAll(".ts-notch")].filter((n) => {
      const r = n.getBoundingClientRect();
      const x = r.left + r.width / 2;
      return x >= box.left && x <= box.right;
    }).length;
  });

/**
 * A finger dragged across the strip from `from` to `to` (shares of its
 * width), through the browser's own touch input, with the strip's scroll and
 * its words sampled on every frame from the touch to a while after it lifts.
 */
async function swipe(
  page: Page,
  scroller: ReturnType<Page["locator"]>,
  from: number,
  to: number,
) {
  const box = (await scroller.boundingBox())!;
  await scroller.evaluate((el) => {
    const words = el
      .closest("[data-time-strip]")!
      .querySelector("[data-hour-when]");
    const samples: [number, number, string][] = [];
    (window as unknown as { samples: typeof samples }).samples = samples;
    const t0 = performance.now();
    const frame = () => {
      samples.push([
        performance.now() - t0,
        el.scrollLeft,
        words?.textContent ?? "",
      ]);
      if (performance.now() - t0 < 2500) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  const cdp = await page.context().newCDPSession(page);
  const y = box.y + box.height / 2;
  const x = (share: number) => box.x + box.width * share;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: x(from), y }],
  });
  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x(from + ((to - from) * i) / steps), y }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(2600);
  await cdp.detach();
  return page.evaluate(
    () =>
      (window as unknown as { samples: [number, number, string][] }).samples,
  );
}

test("the map's strip shows about eight hours, and a swipe carries them under the playhead smoothly", async ({
  page,
}) => {
  await openMap(page);
  const strip = foot(page).locator("[data-time-strip]");
  const scroller = strip.locator(".ts-scroll");
  const when = strip.locator("[data-hour-when]");
  // About eight hours across the phone, a notch for each.
  const across = Number(await strip.getAttribute("data-hours-across"));
  expect(across).toBeGreaterThanOrEqual(6);
  expect(across).toBeLessThanOrEqual(10);
  const notches = await notchesInView(scroller);
  expect(notches).toBeGreaterThanOrEqual(6);
  expect(notches).toBeLessThanOrEqual(11);
  await expect(when).toHaveText(/^Today \d\d:00$/);
  const start = await when.textContent();
  const hour = await strip.evaluate((el) =>
    parseFloat(getComputedStyle(el).getPropertyValue("--ts-hour")),
  );

  // A finger drawn right to left across most of the strip.
  const samples = await swipe(page, scroller, 0.85, 0.2);
  const moving = samples.filter((s, i) => i > 0 && s[1] !== samples[i - 1][1]);
  // The strip followed the finger frame by frame: many small steps, never
  // back, never a leap of more than an hour between two frames.
  expect(moving.length).toBeGreaterThanOrEqual(10);
  for (let i = 1; i < samples.length; i++) {
    const step = samples[i][1] - samples[i - 1][1];
    expect(step).toBeGreaterThanOrEqual(-1);
    expect(step).toBeLessThan(hour);
  }
  const travelled = samples.at(-1)![1] - samples[0][1];
  expect(travelled).toBeGreaterThan(4 * hour);
  // The words over the playhead changed as the hours passed under it, not
  // once at the end.
  const said = new Set(samples.map((s) => s[2]));
  expect(said.size).toBeGreaterThanOrEqual(4);
  // It came to rest on an hour, and the map's hour is the one it says.
  await expect(when).not.toHaveText(start!);
  const rest = await scroller.evaluate((el) => el.scrollLeft);
  expect(Math.abs(rest / hour - Math.round(rest / hour))).toBeLessThan(0.05);
  const slider = foot(page).getByRole("slider", { name: "Hour" });
  await expect(slider).toHaveAttribute(
    "aria-valuetext",
    (await when.textContent())!,
  );

  // On past midnight it carries on into the next day, and says so.
  for (let i = 0; i < 3; i++) await swipe(page, scroller, 0.9, 0.1);
  await expect(when).toHaveText(/^Tomorrow \d\d:00$/);
  await expect(slider).toHaveAttribute("aria-valuetext", /^Tomorrow /);

  // A tap on an hour glides there.
  const box = (await scroller.boundingBox())!;
  const before = await when.textContent();
  await page.touchscreen.tap(box.x + box.width / 2 - 2 * hour, box.y + 20);
  await expect(when).not.toHaveText(before!);
  await expect
    .poll(
      async () =>
        (await slider.getAttribute("aria-valuetext")) ===
        (await when.textContent()),
    )
    .toBe(true);
});

test("the chart's strip on a phone is zoomed in to the hours, and a swipe moves the forecast's time", async ({
  page,
}) => {
  await page.goto("/?map");
  await expect(page.locator(".spot-marker")).toHaveCount(149, {
    timeout: 30000,
  });
  await chooseSpot(page, "brandon");
  const strip = scrubBar(page).locator("[data-time-strip]");
  const across = Number(await strip.getAttribute("data-hours-across"));
  expect(across).toBeGreaterThanOrEqual(6);
  expect(across).toBeLessThanOrEqual(10);
  const start = Number(await timeSlider(page).inputValue());
  await swipe(page, strip.locator(".ts-scroll"), 0.85, 0.25);
  await expect
    .poll(async () => Number(await timeSlider(page).inputValue()))
    .toBeGreaterThan(start + 2);
});
