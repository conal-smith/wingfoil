import { expect, test, type Page } from "./fixtures";

/**
 * The finder's map beside the list (force5/src/lights.ts,
 * force5/src/pillPlace.ts): a pill for every card at least half in the
 * list's view whose spot is in the map's view, never two touching and none
 * on the map's controls, read again once a scroll of the list rests; a bead
 * for every other spot; and the pill, the bead and the card linked under the
 * pointer, with no card over the map.
 */
test.use({ viewport: { width: 1440, height: 900 } });

const panel = (page: Page) =>
  page.getByRole("region", { name: "The chart, at the spots on the list" });
const cards = (page: Page) => page.locator("[data-spot-card]");
const lights = (page: Page) => page.locator(".spot-marker");
const pills = (page: Page) => page.locator(".spot-marker.lt-pilled");

/** The chart at rest: no move on, and its list and pills drawn for it. */
const rest = async (page: Page) => {
  await expect(page.locator(".map-lights.is-moving")).toHaveCount(0);
  await page.waitForTimeout(700);
  await expect(page.locator(".map-lights.is-moving")).toHaveCount(0);
};

/** The ids of the pills on the map, in the page's order. */
const pillIds = (page: Page) =>
  pills(page).evaluateAll((els) =>
    els.map((el) => (el as HTMLElement).dataset.spotId!).sort(),
  );

/**
 * What the map shows of the cards the rider can see: the cards at least half
 * in the list's view; a seen card with no pill whose spot is in the map's
 * view (`missing`); a pill with no seen card (`extra`); two pills touching;
 * and a pill on a control or a station's reading.
 */
const audit = (page: Page) =>
  page.evaluate(() => {
    const map = document.querySelector(".map-canvas")!.getBoundingClientRect();
    const list = document.querySelector("[data-finder-list]")!;
    const view = list.getBoundingClientRect();
    const seen = [...list.querySelectorAll<HTMLElement>("[data-spot-card]")]
      .filter((card) => {
        const r = card.getBoundingClientRect();
        return (
          Math.min(r.bottom, view.bottom) - Math.max(r.top, view.top) >=
          r.height / 2
        );
      })
      .map((card) => card.dataset.spotCard!);
    const marker = (id: string) =>
      document.querySelector<HTMLElement>(
        `.spot-marker[data-spot-id="${CSS.escape(id)}"]`,
      )!;
    const pilled = [
      ...document.querySelectorAll<HTMLElement>(".spot-marker.lt-pilled"),
    ];
    const ids = pilled.map((el) => el.dataset.spotId!);
    const boxes = pilled.map((el) =>
      el.querySelector(".lt-pill")!.getBoundingClientRect(),
    );
    // A seen card with no pill: its bead stands on its spot, which is to be
    // off the map's view, or in the dock's room at its foot.
    const dock = document
      .querySelector("[data-map-dock]")
      ?.getBoundingClientRect();
    const foot = dock ? Math.min(map.bottom, dock.top) : map.bottom;
    const missing = seen.filter((id) => {
      if (ids.includes(id)) return false;
      const r = marker(id).getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      return (
        x > map.left + 4 && x < map.right - 4 && y > map.top + 4 && y < foot - 4
      );
    });
    const hit = (a: DOMRect, b: DOMRect) =>
      a.left < b.right &&
      b.left < a.right &&
      a.top < b.bottom &&
      b.top < a.bottom;
    const overlaps: string[][] = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++)
        if (hit(boxes[i], boxes[j])) overlaps.push([ids[i], ids[j]]);
    const others = [
      ...document.querySelectorAll(
        "[data-map-wall], [data-map-dock], .maplibregl-ctrl, .obs-mark:not(.obs-under) .obs",
      ),
    ]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width && r.height);
    const covered = ids.filter((_, i) => others.some((o) => hit(boxes[i], o)));
    return {
      seen,
      pills: ids,
      missing,
      extra: ids.filter((id) => !seen.includes(id)),
      overlaps,
      covered,
    };
  });

/** Every pill is a seen card's, and every seen card with its spot in view has one, clear of the rest. */
async function pillsAreTheCardsInView(page: Page) {
  await expect
    .poll(async () => {
      const a = await audit(page);
      return { missing: a.missing, extra: a.extra };
    })
    .toEqual({ missing: [], extra: [] });
  const a = await audit(page);
  expect(a.pills.length).toBeGreaterThan(0);
  expect(a.overlaps).toEqual([]);
  expect(a.covered).toEqual([]);
  return a;
}

/** The whole country beside the list, every spot in view. */
async function country(page: Page) {
  await page.goto("/");
  await expect(cards(page).first()).toBeVisible({ timeout: 30000 });
  await expect(lights(page)).toHaveCount(149, { timeout: 30000 });
  await rest(page);
  const more = page.locator("[data-finder-more]");
  for (let i = 0; i < 5; i++) {
    if (/^149 /.test((await more.textContent().catch(() => "")) ?? "")) break;
    await panel(page).getByRole("button", { name: "Zoom out" }).click();
    await rest(page);
  }
  await expect(more).toHaveText(/^149 spots in view/, { timeout: 30000 });
}

/** In round a spot, a double click at a time on the open map beside it. */
async function closeIn(page: Page, id: string, times: number) {
  for (let i = 0; i < times; i++) {
    const at = await page
      .locator(`.spot-marker[data-spot-id="${id}"]`)
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        const x0 = r.x + r.width / 2;
        const y0 = r.y + r.height / 2;
        for (let d = 30; d < 200; d += 6)
          for (let a = 0; a < 360; a += 20) {
            const x = x0 + d * Math.cos((a * Math.PI) / 180);
            const y = y0 + d * Math.sin((a * Math.PI) / 180);
            if (
              document
                .elementFromPoint(x, y)
                ?.classList.contains("maplibregl-canvas")
            )
              return { x, y };
          }
        throw new Error("no open map by the spot");
      });
    await page.mouse.dblclick(at.x, at.y);
    await rest(page);
  }
  await page.mouse.move(5, 300);
  await rest(page);
}

test("at the whole country, Dublin close in and Sligo: a pill for each card in view whose spot is in view, none on another", async ({
  page,
}) => {
  await country(page);
  await expect(page.locator(".spot-marker.pending")).toHaveCount(0, {
    timeout: 30000,
  });
  const whole = await pillsAreTheCardsInView(page);
  // Every other spot a bead.
  await expect(page.locator(".spot-marker.lt-bead")).toHaveCount(
    149 - whole.pills.length,
  );
  // With no field on: the wind's arrow, the wind and its unit, and the sky.
  for (const pill of await pills(page).all()) {
    await expect(pill.locator(".lt-kn")).toHaveText(/^\d+$/);
    await expect(pill.locator(".lt-u")).toHaveText("kn");
  }
  await expect
    .poll(() => page.locator(".spot-marker.lt-pilled .lt-sky").count())
    .toBe(whole.pills.length);
  // No spot's name stands on the map.
  await expect(page.locator(".spot-marker .lt-lab:visible")).toHaveCount(0);

  await closeIn(page, "dollymount", 3);
  await expect(cards(page).filter({ hasText: "Dollymount" })).toHaveCount(1);
  const dublin = await pillsAreTheCardsInView(page);
  expect(dublin.pills.length).toBeGreaterThan(2);
  // So close, some move clear of their neighbours, each with a notch.
  await expect
    .poll(() => page.locator(".spot-marker.lt-pilled .lt-pill[data-n]").count())
    .toBeGreaterThan(0);

  await country(page);
  await closeIn(page, "strandhill", 3);
  await expect(cards(page).filter({ hasText: "Strandhill" })).toHaveCount(1);
  await pillsAreTheCardsInView(page);
});

test("the pills say what the map shows: the wind and the sky, then Wind, Waves or Weather as chosen", async ({
  page,
}) => {
  await country(page);
  await pillsAreTheCardsInView(page);
  const first = pills(page).first();
  // None on: the arrow, the wind with its unit, and the sky after it.
  await expect(first.locator(".lt-u")).toHaveText("kn");
  await expect(first.locator(".lt-pill > :last-child")).toHaveClass(/lt-sky/);
  // Wind: the arrow, the wind and the gust raised, no unit, no sky.
  await page.locator('[data-map-field="wind"]').click();
  await expect(first.locator(".lt-u")).toHaveCount(0);
  await expect(first.locator(".lt-sky")).toHaveCount(0);
  await expect(first.locator(".lt-pa")).toHaveCount(1);
  await expect(first.locator(".lt-kn")).toHaveText(/^\d+$/);
  await rest(page);
  await pillsAreTheCardsInView(page);
  // Weather: the sky first, beside the air's temperature.
  await page.locator('[data-map-field="weather"]').click();
  await expect(first.locator(".lt-pill > :first-child")).toHaveClass(/lt-sky/);
  await expect(first.locator(".lt-kn")).toHaveText(/^-?\d+°$/);
  await expect(first.locator(".lt-pa")).toHaveCount(0);
  await rest(page);
  await pillsAreTheCardsInView(page);
  // Off again: the wind and the sky.
  await page.locator('[data-map-field="weather"]').click();
  await expect(first.locator(".lt-u")).toHaveText("kn");
});

test("the pills follow a scroll of the list once it has rested, never in the middle of it", async ({
  page,
}) => {
  await country(page);
  const before = await pillsAreTheCardsInView(page);
  // Down the list a little at a time, quicker than it rests.
  const during = await page.evaluate(async () => {
    const list = document.querySelector("[data-finder-list]")!;
    const shown = () =>
      [...document.querySelectorAll<HTMLElement>(".spot-marker.lt-pilled")]
        .map((el) => el.dataset.spotId!)
        .sort()
        .join();
    const out: string[] = [];
    for (let i = 0; i < 10; i++) {
      list.scrollBy(0, 70);
      await new Promise((done) => setTimeout(done, 60));
      out.push(shown());
    }
    return out;
  });
  expect(new Set(during)).toEqual(new Set([[...before.pills].sort().join()]));
  // Rested: the cards now in view are the pills.
  await expect.poll(() => pillIds(page)).not.toEqual([...before.pills].sort());
  const after = await pillsAreTheCardsInView(page);
  expect(after.seen).not.toEqual(before.seen);
});

for (const theme of ["dark", "light"] as const)
  test(`a pill under the pointer turns light and outlines its card; a card under the pointer turns its pill light (${theme})`, async ({
    page,
  }) => {
    await page.addInitScript(
      (theme) => localStorage.setItem("wingfoil.theme.v1", theme),
      theme,
    );
    await country(page);
    await pillsAreTheCardsInView(page);
    const fill = (id: string) =>
      page
        .locator(`.spot-marker[data-spot-id="${id}"] .lt-pill`)
        .evaluate((el) => getComputedStyle(el).backgroundColor);
    const ids = await pills(page).evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).dataset.spotId!),
    );
    // Dark with light words, in either theme.
    for (const id of ids) expect(await fill(id)).toBe("rgb(12, 12, 14)");

    const id = ids[1];
    const pill = page.locator(`.spot-marker[data-spot-id="${id}"] .lt-pill`);
    await pill.hover();
    await expect(
      page.locator(`.spot-marker[data-spot-id="${id}"]`),
    ).toHaveClass(/\blit\b/);
    await expect(pill).toHaveCSS("background-color", "rgb(242, 242, 244)");
    await expect(pill).toHaveCSS("color", "rgb(17, 17, 20)");
    const card = page.locator(`[data-spot-card="${id}"]`);
    await expect(card).toHaveAttribute("data-lit", "");
    await expect(card).toHaveCSS("box-shadow", / 0px 0px 0px 2px inset$/);
    await expect(page.locator("[data-spot-card][data-lit]")).toHaveCount(1);
    // Nothing else fades, and no card opens over the map.
    for (const other of ids.filter((o) => o !== id))
      expect(await fill(other)).toBe("rgb(12, 12, 14)");
    await expect(page.locator(".map-card:not([hidden])")).toHaveCount(0);
    await page.mouse.move(5, 300);
    await expect(card).not.toHaveAttribute("data-lit", "");
    await expect(pill).toHaveCSS("background-color", "rgb(12, 12, 14)");

    // A card under the pointer: its pill light, and no other.
    const first = ids[0];
    await page.locator(`[data-spot-card="${first}"]`).hover();
    await expect(
      page.locator(`.spot-marker[data-spot-id="${first}"] .lt-pill`),
    ).toHaveCSS("background-color", "rgb(242, 242, 244)");
    await expect(page.locator(".spot-marker.lit")).toHaveCount(1);
    expect(await fill(id)).toBe("rgb(12, 12, 14)");
  });

test("a bead pressed scrolls the list to its card", async ({ page }) => {
  await country(page);
  await pillsAreTheCardsInView(page);
  // A spot listed far down: its card out of the list's view, a bead on the map.
  const bead = await page.evaluate(() => {
    const map = document.querySelector(".map-panel")!.getBoundingClientRect();
    const list = document
      .querySelector("[data-finder-list]")!
      .getBoundingClientRect();
    for (const el of document.querySelectorAll<HTMLElement>(
      ".spot-marker.lt-bead:not(.lt-under)",
    )) {
      const id = el.dataset.spotId!;
      const card = document.querySelector(`[data-spot-card="${id}"]`);
      const c = card?.getBoundingClientRect();
      if (!c || (c.bottom > list.top && c.top < list.bottom)) continue;
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
        x > map.left + 130 &&
        x < map.right - 130 &&
        y > map.top + 150 &&
        y < map.bottom - 80 &&
        document.elementFromPoint(x, y)?.closest(".spot-marker.lt-bead")
      )
        return { id, x, y };
    }
    throw new Error("no listed bead to reach");
  });
  const card = page.locator(`[data-spot-card="${bead.id}"]`);
  await expect(card).not.toBeInViewport();
  await page.mouse.move(bead.x, bead.y);
  await expect(card).toHaveAttribute("data-lit", "");
  await page.mouse.click(bead.x, bead.y);
  await expect(card).toBeInViewport();
  await expect(page).toHaveURL(/\/$/);
  // Once the list rests, its card is in view and its spot a pill.
  await page.mouse.move(5, 300);
  await expect(
    page.locator(`.spot-marker[data-spot-id="${bead.id}"]`),
  ).toHaveClass(/\blt-pilled\b/);
  await pillsAreTheCardsInView(page);
});
