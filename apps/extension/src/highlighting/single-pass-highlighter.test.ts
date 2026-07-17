// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";

import { highlightSavedTerms } from "./single-pass-highlighter";
import { extractSelectionPath } from "../selection/selection-path";

describe("single-pass highlighter", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main>
        <p>Unfamiliar words can feel unfamiliar.</p>
        <p>Unfamiliarity is a different term.</p>
        <code>unfamiliar</code>
        <button>unfamiliar</button>
      </main>`;
  });

  function getSelectionPathForText(text: string, container: Element) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const index = node.data.indexOf(text);
      if (index >= 0) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + text.length);
        return extractSelectionPath(range);
      }
    }
    return null;
  }

  it("underlines only the specific selected instance using XPath paths", () => {
    const paragraph = document.querySelector("p");
    const path = getSelectionPathForText("Unfamiliar", paragraph!);
    expect(path).not.toBeNull();

    expect(highlightSavedTerms(document, [{ term: "unfamiliar", path: path! }])).toBe(1);

    const highlights = Array.from(document.querySelectorAll("[data-salto-highlight]"));
    expect(highlights).toHaveLength(1);
    expect(highlights[0]?.textContent).toBe("Unfamiliar");
    expect(highlights[0]?.getAttribute("data-salto-highlight")).toBe("unfamiliar");
    expect((highlights[0] as HTMLElement).style.textDecorationStyle).toBe("wavy");
    expect(document.querySelector("code")?.querySelector("[data-salto-highlight]")).toBeNull();
    expect(document.querySelector("button")?.querySelector("[data-salto-highlight]")).toBeNull();
  });

  it("is idempotent and ignores empty path sets", () => {
    expect(highlightSavedTerms(document, [])).toBe(0);

    const paragraph = document.querySelector("p");
    const path = getSelectionPathForText("Unfamiliar", paragraph!);
    expect(path).not.toBeNull();

    expect(highlightSavedTerms(document, [{ term: "unfamiliar", path: path! }])).toBe(1);
    expect(highlightSavedTerms(document, [{ term: "unfamiliar", path: path! }])).toBe(0);
    expect(document.querySelectorAll("[data-salto-highlight]")).toHaveLength(1);
  });

  it("skips highlights when path cannot be resolved", () => {
    const invalidPath = { xpath: "/main/p[99]/text()[1]", startOffset: 0, endOffset: 5 };
    expect(highlightSavedTerms(document, [{ term: "unfamiliar", path: invalidPath }])).toBe(0);
    expect(document.querySelectorAll("[data-salto-highlight]")).toHaveLength(0);
  });

  it("skips highlights when text at path does not match term", () => {
    const paragraph = document.querySelector("p");
    const path = getSelectionPathForText("words", paragraph!);
    expect(path).not.toBeNull();

    expect(highlightSavedTerms(document, [{ term: "unfamiliar", path: path! }])).toBe(0);
    expect(document.querySelectorAll("[data-salto-highlight]")).toHaveLength(0);
  });
});
