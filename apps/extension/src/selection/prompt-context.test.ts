// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import { extractPromptContext } from "./prompt-context";

function selectText(element: Element, start: number, end: number): Range {
  const node = element.firstChild;
  if (!node) throw new Error("missing text node");
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  return range;
}

describe("prompt context extraction", () => {
  it("extracts the containing sentence and adjacent paragraph blocks", () => {
    document.body.innerHTML = `
      <main>
        <p>Previous paragraph.</p>
        <p id="selected">First sentence. An unfamiliar term appears here! Last sentence.</p>
        <p>Next paragraph.</p>
      </main>`;
    document.title = "Fixture";
    history.replaceState({}, "", "/read#fragment");
    const selected = document.querySelector("#selected")!;

    expect(extractPromptContext(selectText(selected, 19, 29), "zh-CN")).toEqual({
      selection: "unfamiliar",
      sentence: "An unfamiliar term appears here!",
      paragraphs: "Previous paragraph.\nFirst sentence. An unfamiliar term appears here! Last sentence.\nNext paragraph.",
      targetLanguage: "zh-CN",
      webTitle: "Fixture",
      webUrl: `${location.origin}/read`,
      webContent: "Previous paragraph. First sentence. An unfamiliar term appears here! Last sentence. Next paragraph."
    });
  });

  it("uses empty strings when sentence context is unavailable near DOM boundaries", () => {
    document.body.innerHTML = '<input id="source" value="unfamiliar">';
    const range = document.createRange();
    range.selectNode(document.querySelector("#source")!);

    expect(extractPromptContext(range, "zh-CN")).toMatchObject({ sentence: "", paragraphs: "" });
  });

  it("filters page chrome and bounds long content around the selected block", () => {
    document.body.innerHTML = `
      <nav>${"navigation ".repeat(300)}</nav>
      <main><p>${"before ".repeat(250)}</p><p id="selected">unfamiliar ${"nearby ".repeat(350)}</p></main>
      <footer>${"footer ".repeat(300)}</footer>`;
    const selected = document.querySelector("#selected")!;

    const context = extractPromptContext(selectText(selected, 0, 10), "zh-CN");

    expect(context.webContent.length).toBeLessThanOrEqual(2000);
    expect(context.webContent).toContain("unfamiliar");
    expect(context.webContent).not.toContain("navigation");
    expect(context.webContent).not.toContain("footer");
  });

  it("excludes CSS-hidden and closed disclosure content", () => {
    document.body.innerHTML = `
      <main>
        <p style="display: none">display hidden</p>
        <p style="visibility: hidden">visibility hidden</p>
        <details>
          <summary>Visible disclosure label</summary>
          <p>closed disclosure content</p>
        </details>
        <p id="selected">Visible unfamiliar term.</p>
      </main>`;
    const selected = document.querySelector("#selected")!;

    const context = extractPromptContext(selectText(selected, 8, 18), "zh-CN");

    expect(context.webContent).toContain("Visible unfamiliar term.");
    expect(context.webContent).not.toContain("display hidden");
    expect(context.webContent).not.toContain("visibility hidden");
    expect(context.webContent).not.toContain("closed disclosure content");
  });

  it("centers long content on the selected occurrence of a repeated term", () => {
    document.body.innerHTML = `
      <main>
        <p>unfamiliar ${"early ".repeat(400)}</p>
        <p id="selected">near-selection unfamiliar ${"late ".repeat(400)}</p>
      </main>`;
    const selected = document.querySelector("#selected")!;

    const context = extractPromptContext(selectText(selected, 15, 25), "zh-CN");

    expect(context.webContent).toContain("near-selection unfamiliar");
    expect(context.webContent.length).toBe(2000);
  });

  it("preserves selected text except for outer whitespace", () => {
    document.body.innerHTML = '<p id="selected">  full  width  </p>';
    const selected = document.querySelector("#selected")!;

    expect(extractPromptContext(selectText(selected, 0, 15), "zh-CN").selection)
      .toBe("full  width");
  });
});
