import {
  barReady,
  expect,
  fieldChip,
  mapDock,
  test,
  type Page,
} from "./fixtures";

/**
 * The layers' rail (src/LayerRail.tsx), the one way to the layers: Layers
 * under the zoom opens a column of round switches beside it, one a layer, in
 * the groups of src/layerGroups.tsx, on a desktop and on a phone. There is no
 * panel behind it; where it would run into the scrub bar, or the map's dock
 * over it, it scrolls. What colours the map is the dock's field, not a layer
 * of the rail's (the ruling of 2026-11-07).
 */

const RAIL_KEY = "wingfoil.map.rail.v1";

const rail = (page: Page) =>
  page.getByRole("toolbar", { name: "Layers", exact: true });
const zoomLayers = (page: Page) =>
  page
    .getByRole("group", { name: "Map controls" })
    .getByRole("button", { name: "Layers", exact: true });
const railButton = (page: Page, name: string) =>
  rail(page).getByRole("button", { name, exact: true });

/** Brandon Bay's week open in the scrub bar, in a window of that size. */
async function openSpot(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto("/?spot=brandon");
  await barReady(page);
}

/**
 * The top of the chart's foot: the scrub bar, the full width of the map, and
 * the map's dock standing over it.
 */
const barTop = async (page: Page) =>
  Math.min(
    (await page.locator(".map-footer").boundingBox())!.y,
    (await page.locator(".scrub").boundingBox())!.y,
    (await mapDock(page).boundingBox())!.y,
  );

/** Each group's name and its layers' names, top to bottom. */
const groupsOf = (box: ReturnType<typeof rail>) =>
  box
    .getByRole("group")
    .evaluateAll((groups) =>
      groups.map((group) => [
        group.getAttribute("aria-label"),
        [...group.querySelectorAll("button")].map((button) =>
          button.getAttribute("aria-label"),
        ),
      ]),
    );

test("on a desktop, Layers opens the rail beside the zoom, clear of the scrub bar, with every layer in its group", async ({
  page,
}) => {
  await openSpot(page, 1440, 900);
  // Shut at first: zoom and Layers alone.
  await expect(rail(page)).toHaveCount(0);
  await expect(zoomLayers(page)).toHaveAttribute("aria-expanded", "false");
  await zoomLayers(page).click();
  await expect(rail(page)).toBeVisible();
  await expect(zoomLayers(page)).toHaveAttribute("aria-expanded", "true");
  // To the left of the zoom, at its top, with no panel open, and clear of
  // the scrub bar below it.
  const zbox = (await page.locator(".zbox").boundingBox())!;
  const box = (await rail(page).boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(zbox.x);
  expect(Math.abs(box.y - zbox.y)).toBeLessThan(6);
  expect(box.y + box.height).toBeLessThan(await barTop(page));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Round switches.
  expect(
    await railButton(page, "Currents").evaluate(
      (el) => el.getBoundingClientRect().width,
    ),
  ).toBe(
    await railButton(page, "Currents").evaluate(
      (el) => el.getBoundingClientRect().height,
    ),
  );

  // Every layer, in its group, in order: few enough to stand in a column on
  // a phone (the owner's ruling of 2026-11-02). The names are always drawn,
  // the depths one switch (the ruling of 2026-11-03); the satellite is one
  // button for either tide; the loupe is on or off (the range ring went on
  // 2026-11-08). Coloured wind, Tidal depth and Rain are the dock's field now.
  expect(await groupsOf(rail(page))).toEqual([
    ["Wind", ["Particles", "Live wind"]],
    ["Sea", ["Currents", "Depths"]],
    ["Ground", ["Satellite, high tide"]],
    ["Round your spot", ["Loupe"]],
  ]);
});

test("the rail's switches: a layer on and off, the particles by themselves, the loupe or the ring, one tide or none", async ({
  page,
}) => {
  await openSpot(page, 1440, 900);
  await zoomLayers(page).click();
  await expect(rail(page)).toBeVisible();

  // A layer, on and off.
  const live = railButton(page, "Live wind");
  await expect(live).toHaveAttribute("aria-pressed", "false");
  await live.click();
  await expect(live).toHaveAttribute("aria-pressed", "true");
  // Its name, and whether it is on, to its left under the pointer.
  await live.hover();
  const tip = live.locator(".lr-tip");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("Live wind · on");
  const at = (await tip.boundingBox())!;
  const button = (await live.boundingBox())!;
  expect(at.x + at.width).toBeLessThanOrEqual(button.x);
  await live.click();
  await expect(live).toHaveAttribute("aria-pressed", "false");

  // The particles, off and on by themselves, and on under the dock's Wind,
  // which leaves them as they are.
  const particles = railButton(page, "Particles");
  await expect(particles).toHaveAttribute("aria-pressed", "true");
  await particles.click();
  await expect(particles).toHaveAttribute("aria-pressed", "false");
  await fieldChip(page, "Wind").click();
  await expect(fieldChip(page, "Wind")).toHaveAttribute("aria-pressed", "true");
  await expect(particles).toHaveAttribute("aria-pressed", "false");
  await particles.click();
  await expect(particles).toHaveAttribute("aria-pressed", "true");
  await expect(fieldChip(page, "Wind")).toHaveAttribute("aria-pressed", "true");
  // Round the spot: nothing, or the loupe, and pressed again nothing.
  const loupe = railButton(page, "Loupe");
  await expect(loupe).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".map-focus")).toHaveAttribute("data-focus", "off");
  await loupe.click();
  await expect(loupe).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".map-focus")).toHaveAttribute(
    "data-focus",
    "loupe",
  );
  await loupe.click();
  await expect(loupe).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".map-focus")).toHaveAttribute("data-focus", "off");
  // The satellite, one button: high tide, then low tide, then none.
  const satellite = rail(page).locator('[data-rail-layer="satellite"]');
  await expect(satellite).toHaveAttribute("aria-pressed", "false");
  await satellite.click();
  await expect(satellite).toHaveAttribute("aria-pressed", "true");
  await expect(satellite).toHaveAccessibleName("Satellite, high tide");
  await satellite.click();
  await expect(satellite).toHaveAttribute("aria-pressed", "true");
  await expect(satellite).toHaveAccessibleName("Satellite, low tide");
  await satellite.click();
  await expect(satellite).toHaveAttribute("aria-pressed", "false");
  await expect(satellite).toHaveAccessibleName("Satellite, high tide");
});

test("the rail stays open or shut on the device, as it was left", async ({
  page,
}) => {
  await openSpot(page, 1440, 900);
  await zoomLayers(page).click();
  await railButton(page, "Live wind").click();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), RAIL_KEY),
  ).toBe("1");
  // Open on the next visit, the layers as they were; shut, and shut on the
  // next.
  await page.reload();
  await expect(rail(page)).toBeVisible({ timeout: 30000 });
  await expect(railButton(page, "Live wind")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await zoomLayers(page).click();
  await expect(rail(page)).toHaveCount(0);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), RAIL_KEY),
  ).toBe("0");
  await page.reload();
  await barReady(page);
  await expect(zoomLayers(page)).toHaveAttribute("aria-expanded", "false");
  await expect(rail(page)).toHaveCount(0);
});

test("the rail is a toolbar: one stop on Tab, the arrows walk it, Space switches", async ({
  page,
}) => {
  await openSpot(page, 1440, 900);
  await zoomLayers(page).focus();
  await page.keyboard.press("Enter");
  await expect(rail(page)).toBeVisible();
  await expect(rail(page)).toHaveAttribute("aria-orientation", "vertical");
  await page.keyboard.press("Tab");
  await expect(railButton(page, "Particles")).toBeFocused();
  // Its name shows on the keys' focus too.
  await expect(railButton(page, "Particles").locator(".lr-tip")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(railButton(page, "Live wind")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(railButton(page, "Live wind")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("ArrowUp");
  await expect(railButton(page, "Particles")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(railButton(page, "Particles")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.keyboard.press("End");
  await expect(railButton(page, "Loupe")).toBeFocused();
  await page.keyboard.press("Home");
  await expect(railButton(page, "Particles")).toBeFocused();
  // One stop: Tab leaves the rail, and Shift+Tab comes back to where it was.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Tab");
  expect(
    await rail(page).evaluate((el) => el.contains(document.activeElement)),
  ).toBe(false);
  await page.keyboard.press("Shift+Tab");
  await expect(railButton(page, "Depths")).toBeFocused();
});

test("the scrub bar has no Layers of its own; where the rail would run into the bar, it scrolls above it", async ({
  page,
}) => {
  await openSpot(page, 1280, 720);
  await expect(
    page.locator(".scrub").getByRole("button", { name: "Layers" }),
  ).toHaveCount(0);
  await zoomLayers(page).click();
  await expect(rail(page)).toBeVisible();
  const clear = async () => {
    const box = (await rail(page).boundingBox())!;
    expect(box.y + box.height).toBeLessThan(await barTop(page));
  };
  await clear();
  await zoomLayers(page).click();
  await expect(rail(page)).toHaveCount(0);
  await zoomLayers(page).click();
  await expect(rail(page)).toBeVisible();
  // A shorter window: the room over the bar is too short for the whole rail,
  // so it stays, shorter, and scrolls to its last layer.
  await page.setViewportSize({ width: 1280, height: 520 });
  await page.mouse.move(400, 300);
  await expect(rail(page)).toBeVisible();
  await expect(zoomLayers(page)).toHaveAttribute("aria-expanded", "true");
  await expect
    .poll(() =>
      rail(page).evaluate((el) => el.scrollHeight > el.clientHeight + 4),
    )
    .toBe(true);
  await clear();
  await railButton(page, "Loupe").scrollIntoViewIfNeeded();
  await expect(railButton(page, "Loupe")).toBeInViewport();
  await clear();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the rail colours nothing: the dock's chips choose the map's field, and the rail's layers stay as they were", async ({
  page,
}) => {
  await page.goto("/?map");
  await zoomLayers(page).click();
  await expect(rail(page)).toBeVisible();
  for (const name of ["Coloured wind", "Tidal depth", "Rain"])
    await expect(railButton(page, name)).toHaveCount(0);
  await railButton(page, "Currents").click();
  await expect(railButton(page, "Currents")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Weather on, then Wind in its place: the rail's own layers are untouched.
  await fieldChip(page, "Weather").click();
  await fieldChip(page, "Wind").click();
  await expect(fieldChip(page, "Weather")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(railButton(page, "Currents")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(railButton(page, "Particles")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
