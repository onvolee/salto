// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  cleanupSavedTermHighlights,
  highlightSavedTerms,
  highlightSavedTermsInDocument
} from "./single-pass-highlighter";
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

  it("wraps single-text-node matches from the core matcher with a stable visible marker", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "New York and York.";
    document.body.replaceChildren(paragraph);

    expect(highlightSavedTermsInDocument(document, ["york", "new york"])).toBe(2);

    const highlights = Array.from(document.querySelectorAll<HTMLElement>("[data-salto-highlight]"));
    expect(highlights.map((element) => [
      element.textContent,
      element.dataset.saltoHighlight
    ])).toEqual([
      ["New York", "en:new york"],
      ["York", "en:york"]
    ]);
    expect(highlights.every((element) => element.style.textDecorationStyle === "wavy")).toBe(true);
  });

  it("skips interactive, editable, code, hidden, Salto-owned, and Shadow DOM text without disturbing host listeners", () => {
    const root = document.createElement("main");
    const allowed = document.createElement("p");
    allowed.textContent = "saved";
    const link = document.createElement("a");
    link.textContent = "saved";
    const button = document.createElement("button");
    button.textContent = "saved";
    const input = document.createElement("input");
    input.value = "saved";
    const textarea = document.createElement("textarea");
    textarea.value = "saved";
    const select = document.createElement("select");
    const option = document.createElement("option");
    option.textContent = "saved";
    select.append(option);
    const code = document.createElement("code");
    code.textContent = "saved";
    const pre = document.createElement("pre");
    pre.textContent = "saved";
    const script = document.createElement("script");
    script.textContent = "saved";
    const style = document.createElement("style");
    style.textContent = "saved";
    const hidden = document.createElement("div");
    hidden.hidden = true;
    hidden.textContent = "saved";
    const ariaHidden = document.createElement("div");
    ariaHidden.setAttribute("aria-hidden", "true");
    ariaHidden.textContent = "saved";
    const cssDisplayHidden = document.createElement("div");
    cssDisplayHidden.style.display = "none";
    cssDisplayHidden.textContent = "saved";
    const cssVisibilityHidden = document.createElement("div");
    cssVisibilityHidden.style.visibility = "hidden";
    const cssHiddenDescendant = document.createElement("span");
    cssHiddenDescendant.textContent = "saved";
    cssVisibilityHidden.append(cssHiddenDescendant);
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    editable.textContent = "saved";
    const saltoUi = document.createElement("salto-selection-popup");
    saltoUi.textContent = "saved";
    const existingHighlight = document.createElement("span");
    existingHighlight.className = "salto-saved-term";
    existingHighlight.dataset.saltoHighlight = "en:saved";
    existingHighlight.textContent = "saved";
    const shadowHost = document.createElement("div");
    shadowHost.attachShadow({ mode: "open" }).append("saved");
    const clicked = vi.fn();
    button.addEventListener("click", clicked);
    root.append(
      allowed, link, button, input, textarea, select, code, pre, script, style,
      hidden, ariaHidden, cssDisplayHidden, cssVisibilityHidden, editable, saltoUi,
      existingHighlight, shadowHost
    );
    document.body.replaceChildren(root);

    expect(highlightSavedTermsInDocument(document, ["saved"])).toBe(1);
    expect(document.querySelectorAll("[data-salto-highlight]")).toHaveLength(2);
    expect(allowed.querySelector("[data-salto-highlight]")?.textContent).toBe("saved");
    expect(root.textContent).toContain("saved");
    button.click();
    expect(clicked).toHaveBeenCalledOnce();
  });

  it("is idempotent and cleans up only Salto wrappers while preserving host text and listeners", () => {
    const root = document.createElement("main");
    const paragraph = document.createElement("p");
    paragraph.textContent = "New York then York";
    const hostMarker = document.createElement("span");
    hostMarker.dataset.saltoHighlight = "host-owned";
    hostMarker.textContent = "untouched";
    root.append(paragraph, hostMarker);
    document.body.replaceChildren(root);
    const clicked = vi.fn();
    root.addEventListener("click", clicked);

    expect(highlightSavedTermsInDocument(document, ["york", "new york"])).toBe(2);
    expect(highlightSavedTermsInDocument(document, ["york", "new york"])).toBe(0);
    expect(cleanupSavedTermHighlights(document)).toBe(2);

    expect(document.querySelectorAll("span.salto-saved-term[data-salto-highlight]")).toHaveLength(0);
    expect(paragraph.textContent).toBe("New York then York");
    expect(paragraph.childNodes).toHaveLength(1);
    expect(hostMarker.isConnected).toBe(true);
    paragraph.click();
    expect(clicked).toHaveBeenCalledOnce();
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
