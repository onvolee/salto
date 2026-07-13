import { describe, expect, it } from "vitest";

import {
  clampToViewport,
  getInitialPanelPosition,
  getTriggerPosition,
} from "./positioning";

const viewport = { width: 1280, height: 800 };

describe("selection popup positioning", () => {
  it("places the trigger above and to the right of the selection", () => {
    expect(
      getTriggerPosition(
        { left: 180, top: 220, right: 260, bottom: 240, width: 80, height: 20 },
        { width: 32, height: 32 },
        viewport,
      ),
    ).toEqual({ x: 268, y: 180 });
  });

  it("keeps the trigger visible near viewport edges", () => {
    expect(
      getTriggerPosition(
        { left: 1260, top: 4, right: 1278, bottom: 24, width: 18, height: 20 },
        { width: 32, height: 32 },
        viewport,
      ),
    ).toEqual({ x: 1240, y: 8 });
  });

  it("opens the panel near the trigger and flips above it at the bottom edge", () => {
    expect(
      getInitialPanelPosition(
        { x: 268, y: 180 },
        { width: 32, height: 32 },
        { width: 360, height: 280 },
        viewport,
      ),
    ).toEqual({ x: 268, y: 220 });

    expect(
      getInitialPanelPosition(
        { x: 940, y: 752 },
        { width: 32, height: 32 },
        { width: 360, height: 280 },
        viewport,
      ),
    ).toEqual({ x: 912, y: 464 });
  });

  it("clamps dragged positions inside the viewport margin", () => {
    expect(clampToViewport({ x: -20, y: 790 }, { width: 360, height: 280 }, viewport)).toEqual({
      x: 8,
      y: 512,
    });
  });
});
