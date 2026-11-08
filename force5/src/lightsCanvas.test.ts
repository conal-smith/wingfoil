import { afterEach, describe, expect, it, vi } from "vitest";
import { lookOf, shadows } from "./lightsCanvas";

describe("shadows", () => {
  it("reads a computed text-shadow list, colours with commas in them", () => {
    expect(
      shadows(
        "rgb(245, 240, 230) 0px 0px 2px, color(srgb 0.9 0.9 0.9 / 0.5) 0px 0px 8px",
      ),
    ).toEqual([
      { color: "rgb(245, 240, 230)", blur: 2 },
      { color: "color(srgb 0.9 0.9 0.9 / 0.5)", blur: 8 },
    ]);
  });
  it("is empty with none", () => {
    expect(shadows("none")).toEqual([]);
    expect(shadows("")).toEqual([]);
  });
});

describe("a dot's picture, on the chart", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** An element as `lookOf` reads one: its styles by name, and what it holds. */
  const part = (style: Record<string, string>, inner: object = {}) => ({
    style,
    textContent: "",
    getAttribute: () => null,
    querySelector: () => null,
    ...inner,
  });

  it("is the ring alone, drawn small in the stylesheet's colour", () => {
    const fills: string[] = [];
    const drawing = {
      setTransform() {},
      scale() {},
      beginPath() {},
      arc() {},
      stroke() {},
      setLineDash() {},
      set fillStyle(colour: string) {
        fills.push(colour);
      },
      fill() {},
    };
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        width: number;
        height: number;
        constructor(width: number, height: number) {
          this.width = width;
          this.height = height;
        }
        getContext = () => drawing;
        transferToImageBitmap = () => ({});
      },
    );
    vi.stubGlobal(
      "getComputedStyle",
      (el: { style: Record<string, string> }) => el.style,
    );
    const hidden = { display: "none" };
    const ring = part({
      fill: "rgb(139, 139, 148)",
      stroke: "none",
      strokeWidth: "0px",
      strokeDasharray: "none",
    });
    const strike = part(hidden);
    const figure = part(hidden);
    const wind = part(hidden);
    const svg = part(
      { transform: "matrix(0.34, 0, 0, 0.34, 0, 0)" },
      {
        querySelector: (at: string) =>
          ({
            ".lt-ring": ring,
            ".lt-strike": strike,
            ".lt-n": figure,
            ".lt-wind": wind,
          })[at],
      },
    );
    const label = part(hidden);
    const pill = part(hidden);
    const el = part(
      {},
      {
        querySelector: (at: string) =>
          ({
            ".lt-lab": label,
            ":scope > .lt-pill": pill,
            ":scope > svg": svg,
          })[at],
      },
    );
    const look = lookOf(el as unknown as HTMLElement, { x: 0, y: 0 }, 1, true);
    expect(look.arrow).toBeNull();
    expect(look.label).toBeNull();
    expect(look.ring.w).toBeLessThan(10);
    expect(fills).toEqual(["rgb(139, 139, 148)"]);
  });

  it("is the bead beside the list: its dot and its halo as a ring round it", () => {
    const fills: string[] = [];
    const arcs: number[] = [];
    const drawing = {
      setTransform() {},
      beginPath() {},
      arc(_x: number, _y: number, r: number) {
        arcs.push(r);
      },
      set fillStyle(colour: string) {
        fills.push(colour);
      },
      fill() {},
    };
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        width: number;
        height: number;
        constructor(width: number, height: number) {
          this.width = width;
          this.height = height;
        }
        getContext = () => drawing;
        transferToImageBitmap = () => ({});
      },
    );
    vi.stubGlobal(
      "getComputedStyle",
      (el: { style: Record<string, string> }) => el.style,
    );
    const bead = part(
      {
        display: "block",
        backgroundColor: "rgba(242, 242, 244, 0.42)",
        boxShadow: "rgba(10, 10, 12, 0.55) 0px 0px 0px 1.2px",
      },
      {
        getBoundingClientRect: () => ({
          left: -2.25,
          top: -2.25,
          width: 4.5,
          height: 4.5,
        }),
      },
    );
    const el = part(
      {},
      {
        querySelector: (at: string) =>
          ({
            ".lt-lab": part({ display: "none" }),
            ":scope > .lt-pill": part({ display: "none" }),
            ":scope > .lt-bead-dot": bead,
          })[at],
      },
    );
    const look = lookOf(el as unknown as HTMLElement, { x: 0, y: 0 }, 2, true);
    expect(look.arrow).toBeNull();
    expect(look.label).toBeNull();
    // The halo first, a ring from the dot's edge out, then the dot.
    expect(fills).toEqual([
      "rgba(10, 10, 12, 0.55)",
      "rgba(242, 242, 244, 0.42)",
    ]);
    expect(arcs).toEqual([2.25 + 1.2, 2.25, 2.25]);
    expect(look.ring.w).toBeLessThan(10);
  });
});
