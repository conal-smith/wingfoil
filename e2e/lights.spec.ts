import { expect, steadyFrames, test, type Page } from "./fixtures";
import { SAMPLE_CLOCK } from "./columns";

/**
 * Through a camera move the lights are drawn on one canvas, and their
 * buttons step aside (force5/src/lights.ts): held mid-drag, a light's button
 * is out of sight and the canvas has it where the chart has moved it; let
 * go, the button is back there and the canvas is clear.
 */

const ID = "brandon";

/** The light's centre on the page. */
const centre = (page: Page) =>
  page.locator(`.spot-marker[data-spot-id="${ID}"]`).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

/** The canvas's most opaque pixel within `r` px of a point on the page. */
const painted = (page: Page, at: { x: number; y: number }, r = 4) =>
  page.evaluate(
    ([at, r]) => {
      const canvas =
        document.querySelector<HTMLCanvasElement>(".lights-canvas")!;
      const box = canvas.getBoundingClientRect();
      const k = canvas.width / box.width;
      const x = Math.round((at.x - box.left - r) * k);
      const y = Math.round((at.y - box.top - r) * k);
      const n = Math.max(1, Math.round(2 * r * k));
      const data = canvas.getContext("2d")!.getImageData(x, y, n, n).data;
      let most = 0;
      for (let i = 3; i < data.length; i += 4) most = Math.max(most, data[i]);
      return most;
    },
    [at, r] as const,
  );

test("through a move the lights are drawn on a canvas, and the buttons come back where the chart has them", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?map");
  await expect(page.locator(".spot-marker").first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator(".spot-marker.pending")).toHaveCount(0, {
    timeout: 30000,
  });
  await steadyFrames(page);
  const before = await centre(page);
  expect(await painted(page, before)).toBe(0);

  // A drag from open chart, held.
  const from = await page.evaluate(() => {
    for (let y = 200; y < 700; y += 37)
      for (let x = 300; x < 1200; x += 41)
        if (
          document
            .elementFromPoint(x, y)
            ?.classList.contains("maplibregl-canvas")
        )
          return { x, y };
    return null;
  });
  expect(from).not.toBeNull();
  const by = { x: 120, y: 60 };
  await page.mouse.move(from!.x, from!.y);
  await page.mouse.down();
  await page.mouse.move(from!.x + by.x, from!.y + by.y, { steps: 12 });
  await page.waitForTimeout(300);
  await expect(page.locator(".map-lights")).toHaveClass(/is-moving/);
  const light = page.locator(`.spot-marker[data-spot-id="${ID}"]`);
  await expect(light).toHaveCSS("opacity", "0");
  const moved = { x: before.x + by.x, y: before.y + by.y };
  expect(await painted(page, moved)).toBeGreaterThan(200);

  // Let go: the button is back, where the chart is now, and nothing is drawn.
  await page.mouse.up();
  await expect(page.locator(".map-lights")).not.toHaveClass(/is-moving/, {
    timeout: 10000,
  });
  await expect(light).toHaveCSS("opacity", "1");
  const after = await centre(page);
  const shift = { x: after.x - before.x, y: after.y - before.y };
  // The drag's own distance, give or take what the chart coasted on after.
  expect(Math.abs(shift.x - by.x)).toBeLessThan(40);
  expect(Math.abs(shift.y - by.y)).toBeLessThan(40);
  expect(await painted(page, after)).toBe(0);
  expect(errors).toEqual([]);
});

test("on the full chart every spot is its rated ring with its wind's arrow, and the finder's map keeps its pills", async ({
  page,
}) => {
  // An afternoon, when the stars are out.
  await page.clock.setFixedTime(
    new Date(SAMPLE_CLOCK.getTime() - 7.5 * 3600000),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?map");
  const lights = page.locator(".spot-marker");
  await expect(lights).toHaveCount(149, { timeout: 30000 });
  await expect(page.locator(".spot-marker.pending")).toHaveCount(0, {
    timeout: 30000,
  });
  await steadyFrames(page);
  // No pill and no bead on the chart (2026-11-14).
  await expect(page.locator(".spot-marker.lt-pilled")).toHaveCount(0);
  await expect(page.locator(".spot-marker.lt-bead")).toHaveCount(0);
  await expect(page.locator(".spot-marker .lt-pill:visible")).toHaveCount(0);

  // A rated ring: filled in its stars' colour, its figure the stars, its
  // arrow the wind, even from the national zoom; and no two full rings stand
  // on each other there.
  const rings = await lights.evaluateAll((els) =>
    els
      .filter((el) => /\bs[1-5]\b/.test(el.className))
      .filter((el) => !el.classList.contains("lt-thin"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        const ring = el.querySelector(".lt-ring")!;
        return {
          id: el.getAttribute("data-spot-id")!,
          stars: Number(/\bs([1-5])\b/.exec(el.className)![1]),
          figure: el.querySelector(".lt-n")!.textContent,
          fill: getComputedStyle(ring).fill,
          arrow: getComputedStyle(el.querySelector(".lt-wind")!).display,
          label: el.getAttribute("aria-label") ?? "",
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
        };
      }),
  );
  expect(rings.length).toBeGreaterThan(10);
  await expect(page.locator(".map-canvas.z-lo")).toHaveCount(1);
  const fills = new Map<number, string>();
  for (const ring of rings) {
    expect(ring.figure).toBe(String(ring.stars));
    expect(ring.label).toContain(
      `${ring.stars} star${ring.stars === 1 ? "" : "s"}`,
    );
    expect(ring.arrow).not.toBe("none");
    if (fills.has(ring.stars)) expect(ring.fill).toBe(fills.get(ring.stars));
    else fills.set(ring.stars, ring.fill);
  }
  // A colour for each number of stars.
  expect(new Set(fills.values()).size).toBe(fills.size);
  for (const [i, a] of rings.entries())
    for (const b of rings.slice(i + 1))
      expect(
        Math.abs(a.x - b.x) >= 20 || Math.abs(a.y - b.y) >= 20,
        `${a.id} and ${b.id} stand on each other`,
      ).toBe(true);

  // Under the mouse a ring grows and says its name; no name stands otherwise.
  await expect(page.locator(".spot-marker .lt-lab:visible")).toHaveCount(0);
  const one = rings.find(
    (r) => r.x > 400 && r.x < 1100 && r.y > 150 && r.y < 650,
  )!;
  await page.mouse.move(one.x, one.y);
  const lab = page.locator(`.spot-marker[data-spot-id="${one.id}"] .lt-lab`);
  await expect(lab).toBeVisible();
  await expect(page.locator(".spot-marker .lt-lab:visible")).toHaveCount(1);

  // The finder's map beside the list keeps its pills and beads, and no ring.
  await page.goto("/");
  await expect
    .poll(() => page.locator(".spot-marker.lt-pilled").count(), {
      timeout: 30000,
    })
    .toBeGreaterThan(0);
  await expect(page.locator(".spot-marker.lt-bead").first()).toBeAttached();
  await expect(page.locator(".spot-marker .lt-ring:visible")).toHaveCount(0);
});
