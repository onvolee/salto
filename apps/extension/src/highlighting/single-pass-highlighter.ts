import type { SelectionPath } from "@salto/core";

import { findNodeByPath } from "../selection/selection-path";

const SKIP_SELECTOR = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "option",
  "code",
  "pre",
  "script",
  "style",
  "[hidden]",
  "[aria-hidden='true']",
  "[contenteditable]:not([contenteditable='false'])",
  "[data-salto-highlight]",
  "salto-selection-popup"
].join(",");

function isSkippable(node: Node): boolean {
  return Boolean(node.parentElement?.closest(SKIP_SELECTOR));
}

export function highlightSavedTerms(
  document: Document,
  paths: readonly { readonly term: string; readonly path: SelectionPath }[]
): number {
  if (!paths.length || !document.body) {
    return 0;
  }

  let count = 0;

  for (const { term, path } of paths) {
    const found = findNodeByPath(document, path);
    if (!found) {
      continue;
    }

    const { node, startOffset, endOffset } = found;

    if (isSkippable(node)) {
      continue;
    }

    const text = node.data;
    const selectedText = text.slice(startOffset, endOffset);

    if (selectedText.toLowerCase() !== term.toLowerCase()) {
      continue;
    }

    const range = document.createRange();
    range.setStart(node, startOffset);
    range.setEnd(node, endOffset);

    const mark = document.createElement("span");
    mark.dataset.saltoHighlight = term.toLocaleLowerCase("en-US");
    mark.className = "salto-saved-term";
    mark.style.textDecorationLine = "underline";
    mark.style.textDecorationStyle = "wavy";
    mark.style.textDecorationThickness = "1px";
    mark.style.textUnderlineOffset = "2px";

    try {
      range.surroundContents(mark);
      count += 1;
    } catch {
      // Range may be invalid if DOM changed
    }
  }

  return count;
}
