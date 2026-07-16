// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExtensionRequest } from "@salto/core";

import { SaltoDatabase } from "../db";
import { highlightSavedTerms } from "../highlighting/single-pass-highlighter";
import { createLocalRepositories } from "../repositories";
import { createBackgroundServices } from "../services/background-services";
import { createFakeQueryExecutor } from "../services/fake-query-executor";
import { SelectionPopupApp } from "./SelectionPopupApp";

const databaseName = "local-slice-integration";
const databases: SaltoDatabase[] = [];
let nextId = 0;

function createInstance() {
  const database = new SaltoDatabase(databaseName);
  databases.push(database);
  const repositories = createLocalRepositories(database, {
    clock: () => "2026-07-16T00:00:00.000Z",
    createId: () => `item-${++nextId}`
  });
  const services = createBackgroundServices({ repositories, queryExecutor: createFakeQueryExecutor() });
  return { database, repositories, services };
}

function selectFixtureTerm() {
  const text = document.querySelector("#fixture")?.firstChild;
  if (!text) throw new Error("fixture missing");
  const range = document.createRange();
  range.setStart(text, 3);
  range.setEnd(text, 13);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  vi.spyOn(range, "getClientRects").mockReturnValue([
    { left: 100, top: 100, right: 180, bottom: 120, width: 80, height: 20 }
  ] as unknown as DOMRectList);
  act(() => document.dispatchEvent(new Event("selectionchange")));
}

describe("local vertical slice", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    document.body.innerHTML = '<main><p id="fixture">An unfamiliar term appears here.</p></main>';
    vi.spyOn(Range.prototype, "getClientRects").mockReturnValue([
      { left: 100, top: 100, right: 180, bottom: 120, width: 80, height: 20 }
    ] as unknown as DOMRectList);
  });

  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    await Promise.all(databases.splice(0).map(async (database) => {
      database.close();
      await database.delete();
    }));
    nextId = 0;
  });

  it("selects, explicitly translates, saves, reopens, and highlights", async () => {
    const first = createInstance();
    const send = vi.fn((request: ExtensionRequest) => first.services.handleMessage(request));
    render(<SelectionPopupApp messageClient={{ send }} />);

    selectFixtureTerm();
    expect(send).not.toHaveBeenCalled();

    await userEvent.setup().click(screen.getByRole("button", { name: "Open selection panel" }));
    expect(await screen.findByText("Default")).toBeInTheDocument();
    expect(screen.getByText("Fake translation: unfamiliar -> zh-CN")).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Save selection" }));
    expect(await screen.findByRole("button", { name: "Selection saved" })).toBeDisabled();
    first.database.close();
    cleanup();

    document.body.innerHTML = '<main><p id="fixture">An unfamiliar term appears here.</p></main>';
    const reopened = createInstance();
    const response = await reopened.services.handleMessage({ type: "list-highlight-terms" });
    expect(response.ok && response.type === "list-highlight-terms" ? response.data.terms : []).toEqual(["unfamiliar"]);
    if (response.ok && response.type === "list-highlight-terms") {
      highlightSavedTerms(document, response.data.terms);
    }
    expect(document.querySelector("[data-salto-highlight]")?.textContent).toBe("unfamiliar");
  });
});
