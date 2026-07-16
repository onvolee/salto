export const MAX_SELECTION_LENGTH = 500;

export type SelectionRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type SelectionSnapshot = {
  text: string;
  range: Range;
  anchorRect: SelectionRect;
};

type SelectionCandidate = {
  isCollapsed: boolean;
  text: string;
};

export function isValidSelection(candidate: SelectionCandidate): boolean {
  const text = candidate.text.trim();

  return !candidate.isCollapsed
    && candidate.text.length <= MAX_SELECTION_LENGTH
    && text.length > 0;
}

export function getLastVisibleRect(rects: readonly SelectionRect[]): SelectionRect | null {
  for (let index = rects.length - 1; index >= 0; index -= 1) {
    const rect = rects[index];
    if (rect && rect.width > 0 && rect.height > 0) {
      return rect;
    }
  }

  return null;
}

export function getRangeAnchorRect(range: Range): SelectionRect | null {
  try {
    return getLastVisibleRect(Array.from(range.getClientRects()));
  } catch {
    return null;
  }
}

export function readSelectionSnapshot(selection: Selection | null): SelectionSnapshot | null {
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const rawText = selection.toString();
  if (!isValidSelection({ isCollapsed: selection.isCollapsed, text: rawText })) {
    return null;
  }
  const text = rawText.trim();

  try {
    const range = selection.getRangeAt(0).cloneRange();
    const anchorRect = getRangeAnchorRect(range);
    return anchorRect ? { text, range, anchorRect } : null;
  } catch {
    return null;
  }
}
