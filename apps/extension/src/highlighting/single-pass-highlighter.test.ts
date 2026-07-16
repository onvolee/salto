// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";

import { highlightSavedTerms } from "./single-pass-highlighter";

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

  it("underlines exact English terms case-insensitively in one initial scan", () => {
    expect(highlightSavedTerms(document, ["unfamiliar"])).toBe(2);

    const highlights = Array.from(document.querySelectorAll("[data-salto-highlight]"));
    expect(highlights.map((node) => node.textContent)).toEqual(["Unfamiliar", "unfamiliar"]);
    expect(highlights[0]?.getAttribute("data-salto-highlight")).toBe("unfamiliar");
    expect((highlights[0] as HTMLElement).style.textDecorationStyle).toBe("wavy");
    expect(document.querySelector("code")?.querySelector("[data-salto-highlight]")).toBeNull();
    expect(document.querySelector("button")?.querySelector("[data-salto-highlight]")).toBeNull();
  });

  it("is idempotent and ignores empty term sets", () => {
    expect(highlightSavedTerms(document, [])).toBe(0);
    expect(highlightSavedTerms(document, ["unfamiliar"])).toBe(2);
    expect(highlightSavedTerms(document, ["unfamiliar"])).toBe(0);
    expect(document.querySelectorAll("[data-salto-highlight]")).toHaveLength(2);
  });
});
