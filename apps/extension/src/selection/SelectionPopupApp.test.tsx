// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SelectionPopupApp } from "./SelectionPopupApp";
import type { ExtensionMessageClient } from "./message-client";

const anchorRect = {
  x: 180,
  y: 220,
  left: 180,
  top: 220,
  right: 260,
  bottom: 240,
  width: 80,
  height: 20,
  toJSON: () => ({}),
};

function selectNodeText(source: Element | null, start: number, end: number) {
  const text = source?.firstChild;
  if (!text) {
    throw new Error("Selection source is unavailable");
  }

  const range = document.createRange();
  range.setStart(text, start);
  range.setEnd(text, end);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  act(() => document.dispatchEvent(new Event("selectionchange")));
}

function selectText(start: number, end: number) {
  selectNodeText(document.querySelector("[data-selection-source]"), start, end);
}

async function openPanel() {
  selectText(0, 10);
  const trigger = await screen.findByRole("button", { name: "Open selection panel" });
  await userEvent.setup().click(trigger);

  return screen.getByRole("dialog", { name: "Selection panel for unfamiliar" });
}

describe("SelectionPopupApp", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    document.body.innerHTML = '<p data-selection-source>unfamiliar second selection</p>';
    vi.spyOn(Range.prototype, "getClientRects").mockReturnValue([
      anchorRect,
    ] as unknown as DOMRectList);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows a trigger for a valid selection and opens only on click", async () => {
    render(<SelectionPopupApp />);
    selectText(0, 10);

    const trigger = screen.getByRole("button", { name: "Open selection panel" });
    const user = userEvent.setup();
    await user.hover(trigger);
    trigger.focus();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(trigger);

    expect(trigger).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Selection panel for unfamiliar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close panel" })).toHaveFocus();
  });

  it("does not query on selection and renders ordered fields after explicit open", async () => {
    const send = vi.fn<ExtensionMessageClient["send"]>().mockResolvedValue({
      ok: true,
      type: "translate-selection",
      data: {
        templateId: "system-default",
        templateName: "Default",
        schema: [{ id: "translation", label: "Translation" }, { id: "points", label: "Key points" }],
        fields: [
          { fieldId: "translation", status: "ready", type: "text", value: "陌生的" },
          { fieldId: "points", status: "ready", type: "list", value: ["adjective", "not known"] }
        ]
      }
    });
    render(<SelectionPopupApp messageClient={{ send }} />);
    selectText(0, 10);

    expect(send).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole("button", { name: "Open selection panel" }));

    expect(await screen.findByText("Default")).toBeInTheDocument();
    expect(screen.getAllByRole("term").map((node) => node.textContent)).toEqual(["Translation", "Key points"]);
    expect(screen.getByText("陌生的")).toBeInTheDocument();
    expect(screen.getByText("adjective")).toBeInTheDocument();
    expect(send).toHaveBeenCalledOnce();
  });

  it("renders partial field failures and saves idempotently", async () => {
    const send = vi.fn<ExtensionMessageClient["send"]>()
      .mockResolvedValueOnce({
        ok: true,
        type: "translate-selection",
        data: {
          templateId: "system-default",
          templateName: "Default",
          schema: [{ id: "translation", label: "Translation" }, { id: "points", label: "Key points" }],
          fields: [
            { fieldId: "translation", status: "ready", type: "text", value: "陌生的" },
            { fieldId: "points", status: "failed", error: { code: "fake-failure", message: "Field unavailable" } }
          ]
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        type: "save-vocabulary",
        data: { status: "saved", vocabularyItemId: "item-1" }
      });
    render(<SelectionPopupApp messageClient={{ send }} />);
    await openPanel();

    expect(await screen.findByText("Field unavailable")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save selection" });
    await userEvent.setup().click(save);
    await userEvent.setup().click(save);

    expect(await screen.findByRole("button", { name: "Selection saved" })).toBeDisabled();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("renders a request-level error without changing panel geometry", async () => {
    const send = vi.fn<ExtensionMessageClient["send"]>().mockResolvedValue({
      ok: false,
      error: { code: "request-failed", message: "The extension request could not be completed" }
    });
    render(<SelectionPopupApp messageClient={{ send }} />);
    const panel = await openPanel();

    expect(await screen.findByText("The extension request could not be completed")).toBeInTheDocument();
    expect(panel).toHaveStyle({ left: "268px", top: "220px" });
  });

  it("allows retrying a failed save", async () => {
    const send = vi.fn<ExtensionMessageClient["send"]>()
      .mockResolvedValueOnce({
        ok: true,
        type: "translate-selection",
        data: { templateId: "system-default", templateName: "Default", schema: [], fields: [] }
      })
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "request-failed", message: "Could not save" }
      })
      .mockResolvedValueOnce({
        ok: true,
        type: "save-vocabulary",
        data: { status: "saved", vocabularyItemId: "item-1" }
      });
    render(<SelectionPopupApp messageClient={{ send }} />);
    await openPanel();
    const save = screen.getByRole("button", { name: "Save selection" });

    await userEvent.setup().click(save);
    expect(await screen.findByText("Could not save selection")).toBeInTheDocument();
    await userEvent.setup().click(save);

    expect(await screen.findByRole("button", { name: "Selection saved" })).toBeDisabled();
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("announces a save while the request is pending", async () => {
    let resolveSave!: (response: Awaited<ReturnType<ExtensionMessageClient["send"]>>) => void;
    const send = vi.fn<ExtensionMessageClient["send"]>()
      .mockResolvedValueOnce({
        ok: true,
        type: "translate-selection",
        data: { templateId: "system-default", templateName: "Default", schema: [], fields: [] }
      })
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveSave = resolve;
      }));
    render(<SelectionPopupApp messageClient={{ send }} />);
    await openPanel();

    await userEvent.setup().click(screen.getByRole("button", { name: "Save selection" }));

    expect(screen.getByRole("button", { name: "Saving selection" })).toBeDisabled();
    expect(screen.getByText("Saving selection...")).toBeInTheDocument();

    await act(async () => resolveSave({
      ok: true,
      type: "save-vocabulary",
      data: { status: "saved", vocabularyItemId: "item-1" }
    }));
  });

  it("ignores a translation response after deliberate close", async () => {
    let resolveRequest!: (response: Awaited<ReturnType<ExtensionMessageClient["send"]>>) => void;
    const send = vi.fn<ExtensionMessageClient["send"]>().mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    render(<SelectionPopupApp messageClient={{ send }} />);
    await openPanel();
    await userEvent.setup().click(screen.getByRole("button", { name: "Close panel" }));

    await act(async () => resolveRequest({
      ok: true,
      type: "translate-selection",
      data: {
        templateId: "system-default",
        templateName: "Stale",
        schema: [],
        fields: []
      }
    }));

    expect(screen.queryByText("Stale")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ignores a save response after close and a new selection", async () => {
    let resolveSave!: (response: Awaited<ReturnType<ExtensionMessageClient["send"]>>) => void;
    const send = vi.fn<ExtensionMessageClient["send"]>()
      .mockResolvedValueOnce({
        ok: true,
        type: "translate-selection",
        data: { templateId: "system-default", templateName: "Default", schema: [], fields: [] }
      })
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveSave = resolve;
      }))
      .mockResolvedValueOnce({
        ok: true,
        type: "translate-selection",
        data: { templateId: "system-default", templateName: "Default", schema: [], fields: [] }
      });
    render(<SelectionPopupApp messageClient={{ send }} />);
    await openPanel();
    await userEvent.setup().click(screen.getByRole("button", { name: "Save selection" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Close panel" }));

    selectText(11, 27);
    await userEvent.setup().click(screen.getByRole("button", { name: "Open selection panel" }));
    await screen.findByRole("heading", { name: "Default" });

    await act(async () => resolveSave({
      ok: true,
      type: "save-vocabulary",
      data: { status: "saved", vocabularyItemId: "item-a" }
    }));

    expect(screen.getByRole("button", { name: "Save selection" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Selection saved" })).not.toBeInTheDocument();
  });

  it.each([
    ["close button", async () => userEvent.setup().click(screen.getByRole("button", { name: "Close panel" }))],
    ["Escape", async () => userEvent.setup().keyboard("{Escape}")],
    ["ordinary outside click", async () => userEvent.setup().click(document.querySelector("[data-selection-source]")!)],
  ])("closes with %s and clears the browser selection", async (_name, closePanel) => {
    render(<SelectionPopupApp />);
    await openPanel();

    await closePanel();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.getSelection()?.rangeCount).toBe(0);
    expect(screen.queryByRole("button", { name: "Open selection panel" })).not.toBeInTheDocument();
  });

  it("ignores a new selection gesture while the panel is open", async () => {
    render(<SelectionPopupApp />);
    const panel = await openPanel();
    const source = document.querySelector("[data-selection-source]")!;

    fireEvent.pointerDown(source, { button: 0, clientX: 40, clientY: 40, pointerId: 2 });
    selectText(11, 27);
    fireEvent.pointerUp(source, { button: 0, clientX: 180, clientY: 40, pointerId: 2 });
    fireEvent.click(source);

    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAccessibleName("Selection panel for unfamiliar");
    expect(screen.queryByRole("button", { name: "Open selection panel" })).not.toBeInTheDocument();
  });

  it.each([
    ["whitespace", "   "],
    ["more than 500 characters", "x".repeat(501)],
  ])("does not close for an outside drag selecting %s", async (_name, text) => {
    render(<SelectionPopupApp />);
    const panel = await openPanel();
    const source = document.createElement("p");
    source.textContent = text;
    document.body.append(source);

    fireEvent.pointerDown(source, { button: 0, clientX: 40, clientY: 40, pointerId: 5 });
    selectNodeText(source, 0, text.length);
    fireEvent.pointerUp(source, { button: 0, clientX: 180, clientY: 40, pointerId: 5 });
    fireEvent.click(source);

    expect(panel).toBeInTheDocument();
  });

  it("does not close when an outside drag produces the same selection range", async () => {
    render(<SelectionPopupApp />);
    const panel = await openPanel();
    const source = document.querySelector("[data-selection-source]")!;

    fireEvent.pointerDown(source, { button: 0, clientX: 40, clientY: 40, pointerId: 6 });
    selectText(0, 10);
    fireEvent.pointerUp(source, { button: 0, clientX: 180, clientY: 40, pointerId: 6 });
    fireEvent.click(source);

    expect(panel).toBeInTheDocument();
  });

  it("closes after an outside drag that does not form a selection", async () => {
    render(<SelectionPopupApp />);
    await openPanel();
    const source = document.querySelector("[data-selection-source]")!;

    fireEvent.pointerDown(source, { button: 0, clientX: 40, clientY: 40, pointerId: 7 });
    fireEvent.pointerUp(source, { button: 0, clientX: 180, clientY: 40, pointerId: 7 });
    fireEvent.click(source);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.getSelection()?.rangeCount).toBe(0);
  });

  it("drags from the non-button header area and not from header actions", async () => {
    render(<SelectionPopupApp />);
    const panel = await openPanel();
    const header = screen.getByTestId("selection-panel-header");
    const bookmark = screen.getByRole("button", { name: "Save selection" });

    fireEvent.pointerDown(header, {
      button: 0,
      clientX: 300,
      clientY: 250,
      isPrimary: true,
      pointerId: 3,
    });
    fireEvent.pointerMove(header, { clientX: 450, clientY: 380, pointerId: 3 });
    fireEvent.pointerUp(header, { clientX: 450, clientY: 380, pointerId: 3 });

    expect(panel).toHaveStyle({ left: "418px", top: "350px" });

    fireEvent.pointerDown(bookmark, { button: 0, clientX: 430, clientY: 365, pointerId: 4 });
    fireEvent.pointerMove(header, { clientX: 700, clientY: 600, pointerId: 4 });
    fireEvent.pointerUp(header, { clientX: 700, clientY: 600, pointerId: 4 });

    expect(panel).toHaveStyle({ left: "418px", top: "350px" });
  });

  it("does not start dragging from a non-primary pointer", async () => {
    render(<SelectionPopupApp />);
    const panel = await openPanel();
    const header = screen.getByTestId("selection-panel-header");

    fireEvent.pointerDown(header, {
      button: 0,
      clientX: 300,
      clientY: 250,
      isPrimary: false,
      pointerId: 8,
    });
    fireEvent.pointerMove(header, { clientX: 450, clientY: 380, pointerId: 8 });
    fireEvent.pointerUp(header, { clientX: 450, clientY: 380, pointerId: 8 });

    expect(panel).toHaveStyle({ left: "268px", top: "220px" });
  });
});
