// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";

import { act, fireEvent, waitFor, within } from "@testing-library/react";
import { createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { QueryTemplate } from "@salto/core";

import type { ExtensionMessageClient } from "./message-client";
import { SelectionPanel } from "./SelectionPanel";
import { SelectionPopupApp } from "./SelectionPopupApp";

const template: QueryTemplate = {
  id: "system-default",
  name: "Default",
  createdAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z",
  fields: [{
    id: "translation",
    definitionId: "definition-translation",
    content: { label: "Translation", source: "llm", type: "text", instruction: "Translate {{selection}}." },
    order: 0,
    enabled: true,
  }],
};

function createShadowRootRenderTarget(): {
  container: HTMLDivElement;
  root: Root;
  shadowRoot: ShadowRoot;
} {
  const host = document.createElement("div");
  document.body.append(host);
  const shadowRoot = host.attachShadow({ mode: "open" });
  const container = document.createElement("div");
  shadowRoot.append(container);
  return { container, root: createRoot(container), shadowRoot };
}

describe("selection panel Shadow DOM focus", () => {
  const roots: Root[] = [];

  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  });

  afterEach(async () => {
    await act(async () => roots.splice(0).forEach((root) => root.unmount()));
    document.body.replaceChildren();
    window.getSelection()?.removeAllRanges();
    vi.restoreAllMocks();
  });

  it("does not autofocus and loops Tab once focus enters the shadow-root panel", async () => {
    const target = createShadowRootRenderTarget();
    roots.push(target.root);
    await act(async () => target.root.render(
      <SelectionPanel
        activeTemplate={{ status: "ready", template, resolution: { status: "active" } }}
        onClose={vi.fn()}
        onPositionChange={vi.fn()}
        onRegenerate={vi.fn()}
        onSave={vi.fn()}
        panelRef={createRef<HTMLElement>()}
        position={{ x: 20, y: 20 }}
        saveState="idle"
        selectionText="unfamiliar"
        translation={{
          status: "complete",
          data: { templateId: template.id, templateName: template.name, schema: [], fields: [] },
        }}
      />,
    ));

    const panel = within(target.container);
    const regenerate = panel.getByRole("button", { name: "Regenerate translation" });
    const close = panel.getByRole("button", { name: "Close panel" });
    expect(target.shadowRoot.activeElement).not.toBe(close);

    close.focus();
    expect(target.shadowRoot.activeElement).toBe(close);
    expect(document.activeElement).not.toBe(close);

    fireEvent.keyDown(close, { key: "Tab" });
    expect(target.shadowRoot.activeElement).toBe(regenerate);

    fireEvent.keyDown(regenerate, { key: "Tab", shiftKey: true });
    expect(target.shadowRoot.activeElement).toBe(close);
  });

  it("applies each saved snapshot style without leaking invalid declarations", async () => {
    const styledTemplate: QueryTemplate = {
      ...template,
      fields: [
        {
          ...template.fields[0],
          keyCss: "color: rgb(1, 2, 3);",
          valueCss: "font-weight: 700;",
        },
        {
          ...template.fields[0],
          id: "context",
          content: { ...template.fields[0].content, label: "Context" },
          keyCss: "not-a-declaration",
          valueCss: "also invalid",
          order: 1,
        },
      ],
    };
    const target = createShadowRootRenderTarget();
    roots.push(target.root);
    await act(async () => target.root.render(
      <SelectionPanel
        activeTemplate={{ status: "ready", template: styledTemplate, resolution: { status: "active" } }}
        onClose={vi.fn()}
        onPositionChange={vi.fn()}
        onRegenerate={vi.fn()}
        onSave={vi.fn()}
        panelRef={createRef<HTMLElement>()}
        position={{ x: 20, y: 20 }}
        saveState="idle"
        selectionText="unfamiliar"
        translation={{
          status: "complete",
          data: {
            templateId: styledTemplate.id,
            templateName: styledTemplate.name,
            schema: [
              { id: "translation", label: "Translation" },
              { id: "context", label: "Context" },
            ],
            fields: [
              { fieldId: "translation", status: "ready", type: "text", value: "翻译" },
              { fieldId: "context", status: "ready", type: "text", value: "上下文" },
            ],
          },
        }}
      />,
    ));

    const panel = within(target.container);
    expect(panel.getByText("Translation")).toHaveStyle({ color: "rgb(1, 2, 3)" });
    expect(panel.getByText("翻译")).toHaveStyle({ fontWeight: "700" });
    expect(panel.getByText("Context")).not.toHaveAttribute("style");
    expect(panel.getByText("上下文").closest("dd")).not.toHaveAttribute("style");
  });

  it("restores focus to the floating trigger after closing inside a shadow root", async () => {
    const source = document.createElement("p");
    source.textContent = "unfamiliar term";
    document.body.append(source);
    vi.spyOn(Range.prototype, "getClientRects").mockReturnValue([{
      left: 100,
      top: 100,
      right: 180,
      bottom: 120,
      width: 80,
      height: 20,
    }] as unknown as DOMRectList);
    const send = vi.fn<ExtensionMessageClient["send"]>().mockImplementation(async (request) => {
      if (request.type === "get-active-query-template") {
        return {
          ok: true,
          type: request.type,
          data: { template, resolution: { status: "active" } },
        };
      }
      return {
        ok: true,
        type: "translate-selection",
        data: { templateId: template.id, templateName: template.name, schema: [], fields: [] },
      };
    });
    const target = createShadowRootRenderTarget();
    roots.push(target.root);
    await act(async () => target.root.render(
      <SelectionPopupApp
        messageClient={{ send }}
        subscribePanelOpen={() => () => undefined}
      />,
    ));

    const range = document.createRange();
    range.selectNodeContents(source);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    act(() => document.dispatchEvent(new Event("selectionchange")));

    const popup = within(target.container);
    fireEvent.click(await popup.findByRole("button", { name: "Open selection panel" }));
    const close = await popup.findByRole("button", { name: "Close panel" });
    expect(target.shadowRoot.activeElement).not.toBe(close);

    close.focus();
    expect(target.shadowRoot.activeElement).toBe(close);

    fireEvent.click(close);
    const trigger = await popup.findByRole("button", { name: "Open selection panel" });
    await waitFor(() => expect(target.shadowRoot.activeElement).toBe(trigger));
  });
});
