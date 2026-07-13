import type { SelectionRect } from "./selection";

export type Point = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export const VIEWPORT_MARGIN = 8;
export const SURFACE_GAP = 8;
export const PANEL_PREFERRED_SIZE: Size = { width: 360, height: 220 };

export function getPanelSize(viewport: Size): Size {
  return {
    width: Math.min(PANEL_PREFERRED_SIZE.width, Math.max(0, viewport.width - VIEWPORT_MARGIN * 2)),
    height: Math.min(PANEL_PREFERRED_SIZE.height, Math.max(0, viewport.height - VIEWPORT_MARGIN * 2)),
  };
}

export function clampToViewport(
  point: Point,
  surface: Size,
  viewport: Size,
  margin = VIEWPORT_MARGIN,
): Point {
  const maxX = Math.max(margin, viewport.width - surface.width - margin);
  const maxY = Math.max(margin, viewport.height - surface.height - margin);

  return {
    x: Math.min(Math.max(point.x, margin), maxX),
    y: Math.min(Math.max(point.y, margin), maxY),
  };
}

export function getTriggerPosition(
  anchor: SelectionRect,
  trigger: Size,
  viewport: Size,
): Point {
  return clampToViewport(
    {
      x: anchor.right + SURFACE_GAP,
      y: anchor.top - trigger.height - SURFACE_GAP,
    },
    trigger,
    viewport,
  );
}

export function getInitialPanelPosition(
  triggerPosition: Point,
  trigger: Size,
  panel: Size,
  viewport: Size,
): Point {
  const belowY = triggerPosition.y + trigger.height + SURFACE_GAP;
  const availableBottom = viewport.height - VIEWPORT_MARGIN;
  const y = belowY + panel.height <= availableBottom
    ? belowY
    : triggerPosition.y - panel.height - SURFACE_GAP;

  return clampToViewport({ x: triggerPosition.x, y }, panel, viewport);
}
