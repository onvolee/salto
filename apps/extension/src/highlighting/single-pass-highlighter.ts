import { findSavedTermMatches, type SelectionPath } from "@salto/core";

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

function hasCssHiddenAncestor(node: Node, hiddenAncestors: WeakMap<Element, boolean>): boolean {
  const visited: Element[] = [];
  for (let element = node.parentElement; element; element = element.parentElement) {
    const knownHidden = hiddenAncestors.get(element);
    if (knownHidden !== undefined) {
      for (const visitedElement of visited) {
        hiddenAncestors.set(visitedElement, knownHidden);
      }
      return knownHidden;
    }

    visited.push(element);
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    const isHidden = style?.display === "none" || style?.visibility === "hidden";
    if (isHidden) {
      for (const visitedElement of visited) {
        hiddenAncestors.set(visitedElement, true);
      }
      return true;
    }
  }

  for (const visitedElement of visited) {
    hiddenAncestors.set(visitedElement, false);
  }
  return false;
}

function isSkippable(node: Node, hiddenAncestors = new WeakMap<Element, boolean>()): boolean {
  return !node.isConnected
    || node.getRootNode() !== node.ownerDocument
    || hasCssHiddenAncestor(node, hiddenAncestors)
    || Boolean(node.parentElement?.closest(SKIP_SELECTOR));
}

function createHighlightWrapper(document: Document, canonicalKey: string): HTMLSpanElement {
  const mark = document.createElement("span");
  mark.dataset.saltoHighlight = canonicalKey;
  mark.className = "salto-saved-term";
  mark.style.textDecorationLine = "underline";
  mark.style.textDecorationStyle = "wavy";
  mark.style.textDecorationThickness = "1px";
  mark.style.textUnderlineOffset = "2px";
  return mark;
}

export function highlightSavedTermsInDocument(
  document: Document,
  terms: readonly string[]
): number {
  if (!document.body || terms.length === 0) {
    return 0;
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Text && !isSkippable(node)) {
      nodes.push(node);
    }
  }

  return createSavedTermTextNodeHighlighter(document, terms).highlight(nodes);
}

export type SavedTermTextNodeHighlighter = {
  highlight(nodes: readonly Text[]): number;
};

export function createSavedTermTextNodeHighlighter(
  document: Document,
  terms: readonly string[]
): SavedTermTextNodeHighlighter {
  return {
    highlight(nodes) {
      let count = 0;
      const hiddenAncestors = new WeakMap<Element, boolean>();

      for (const node of nodes) {
        if (isSkippable(node, hiddenAncestors)) {
          continue;
        }

        const matches = findSavedTermMatches(node.data, terms);
        for (const match of [...matches].reverse()) {
          const range = document.createRange();
          range.setStart(node, match.start);
          range.setEnd(node, match.end);
          range.surroundContents(createHighlightWrapper(document, match.canonicalKey));
          count += 1;
        }
      }

      return count;
    },
  };
}

export function cleanupSavedTermHighlights(document: Document): number {
  const highlights = Array.from(document.querySelectorAll<HTMLSpanElement>(
    "span.salto-saved-term[data-salto-highlight]"
  ));
  const affectedParents = new Set<ParentNode>();

  for (const highlight of highlights) {
    const parent = highlight.parentNode;
    if (!parent) {
      continue;
    }

    while (highlight.firstChild) {
      parent.insertBefore(highlight.firstChild, highlight);
    }
    highlight.remove();
    affectedParents.add(parent);
  }

  for (const parent of affectedParents) {
    parent.normalize();
  }

  return highlights.length;
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
