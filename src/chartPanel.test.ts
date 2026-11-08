import { describe, expect, it } from "vitest";
import { fitPadding, fitPaddingOver } from "./chartPanel";

describe("fitPaddingOver", () => {
  it("keeps a fitted place a margin above the map's dock", () => {
    expect(fitPaddingOver(96)).toEqual({ ...fitPadding, bottom: 120 });
  });

  it("keeps the usual margin where there is no dock, or a shallow one", () => {
    expect(fitPaddingOver(0)).toEqual(fitPadding);
    expect(fitPaddingOver(10).bottom).toBe(fitPadding.bottom);
  });
});
