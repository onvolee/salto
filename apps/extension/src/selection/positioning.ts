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
export const PANEL_MIN_SIZE: Size = { width: 360, height: 220 };

export function clampPanelSize(size: Size, viewport: Size): Size {
  const maxWidth = Math.max(0, viewport.width - VIEWPORT_MARGIN * 2);
  const maxHeight = Math.max(0, viewport.height - VIEWPORT_MARGIN * 2);

  return {
    width: Math.min(size.width, maxWidth),
    height: Math.min(size.height, maxHeight),
  };
}

export function clampResizeSize(size: Size, viewport: Size): Size {
  const maxWidth = Math.max(0, viewport.width - VIEWPORT_MARGIN * 2);
  const maxHeight = Math.max(0, viewport.height - VIEWPORT_MARGIN * 2);

  return {
    width: Math.max(PANEL_MIN_SIZE.width, Math.min(size.width, maxWidth)),
    height: Math.max(PANEL_MIN_SIZE.height, Math.min(size.height, maxHeight)),
  };
}

export function getPanelSize(viewport: Size, preferredSize?: Size): Size {
  const baseSize = preferredSize ?? PANEL_MIN_SIZE;
  return clampPanelSize(baseSize, viewport);
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
