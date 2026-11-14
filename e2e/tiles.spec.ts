import { expect, test, type Page } from "./fixtures";
import { readSample } from "./sample";
import { SAMPLE_CLOCK } from "./columns";

/**
 * The map reads its wind as tiles (force5/src/tiledField.ts): the level the
 * screen needs, and only the tiles in view. The e2e site's HARMONIE is the real
 * grid (scripts/sample-weather.mjs --site), so it has all three levels the
 * production run has: nine native tiles, four at level 1, one at level 2.
 */
const harmonie = readSample("harmonie");

/** Every HARMONIE tile the page asks for, as [level, x, y, hour]. */
function tilesAsked(page: Page) {
  const asked: [number, number, number, number][] = [];
  page.on("request", (request) => {
    const found =
      /\/weather\/harmonie-[^/]+\/t\/(\d+)\/(\d+)\/(\d+)\/(\d+)\.bin$/.exec(
        new URL(request.url()).pathname,
      );
    if (found)
      asked.push(
        found.slice(1).map(Number) as [number, number, number, number],
      );
  });
  return asked;
}

const places = (asked: [number, number, number, number][], level: number) => [
  ...new Set(
    asked.filter((tile) => tile[0] === level).map(([, x, y]) => `${x}/${y}`),
  ),
];

test("a desktop showing all of Ireland asks for the native tiles and never an absent one", async ({
  page,
}) => {
  const asked = tilesAsked(page);
  await page.goto("/?map");
  await expect(page.locator(".spot-marker")).toHaveCount(149, {
    timeout: 30000,
  });
  await expect
    .poll(() => places(asked, 0).length, { timeout: 20000 })
    .toBeGreaterThan(0);
  const absent = new Set(
    harmonie.tiles.levels.flatMap(
      (level: { level: number; absent: number[][] }) =>
        level.absent.map(([x, y]) => `${level.level}/${x}/${y}`),
    ),
  );
  expect(
    asked.filter(([level, x, y]) => absent.has(`${level}/${x}/${y}`)),
  ).toEqual([]);
});

test("the first frame the page asks for is the one it opens on", async ({
  page,
}) => {
  // The page used to ask for the run's first hour, and prefetch the second,
  // before it knew its opening time, then for the hour it opens on: the first
  // pair was thrown away on every load.
  await page.setViewportSize({ width: 390, height: 844 });
  const asked = tilesAsked(page);
  await page.clock.install({ time: SAMPLE_CLOCK });
  await page.goto("/?map");
  await expect(page.locator(".spot-marker")).toHaveCount(149, {
    timeout: 30000,
  });
  await expect.poll(() => asked.length, { timeout: 20000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  const hours = [...new Set(asked.map(([, , , hour]) => hour))];
  // The opening hour first, then the hours either side of it, read ahead
  // for a scrub either way; nothing else.
  expect(hours).toHaveLength(3);
  expect(hours[0]).toBeGreaterThan(0);
  const at = harmonie.frames.findIndex(
    (frame: { hour: number }) => frame.hour === hours[0],
  );
  expect(hours.slice(1).sort((a, b) => a - b)).toEqual([
    harmonie.frames[at - 1].hour,
    harmonie.frames[at + 1].hour,
  ]);
});
