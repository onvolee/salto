import { describe, expect, it } from "vitest";

import { getLastVisibleRect, isValidSelection } from "./selection";

describe("selection", () => {
  it("accepts non-collapsed text selections up to 500 characters", () => {
    expect(isValidSelection({ isCollapsed: false, text: "unfamiliar" })).toBe(true);
    expect(isValidSelection({ isCollapsed: false, text: "a".repeat(500) })).toBe(true);
  });

  it("rejects collapsed, blank, and overlong selections", () => {
    expect(isValidSelection({ isCollapsed: true, text: "unfamiliar" })).toBe(false);
    expect(isValidSelection({ isCollapsed: false, text: "  \n\t" })).toBe(false);
    expect(isValidSelection({ isCollapsed: false, text: "a".repeat(501) })).toBe(false);
    expect(isValidSelection({ isCollapsed: false, text: ` ${"a".repeat(500)} ` })).toBe(false);
  });

  it("uses the last visible rectangle for a multi-line selection", () => {
    const first = { left: 120, top: 80, right: 310, bottom: 100, width: 190, height: 20 };
    const empty = { left: 310, top: 100, right: 310, bottom: 100, width: 0, height: 0 };
    const last = { left: 120, top: 104, right: 224, bottom: 124, width: 104, height: 20 };

    expect(getLastVisibleRect([first, empty, last])).toEqual(last);
    expect(getLastVisibleRect([empty])).toBeNull();
  });
});
