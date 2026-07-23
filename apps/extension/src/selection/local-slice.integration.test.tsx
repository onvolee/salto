// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExtensionRequest } from "@salto/core";

import { SaltoDatabase } from "../db";
import { createHighlightSession } from "../highlighting/highlight-session";
import { createIncrementalHighlightScanner } from "../highlighting/incremental-highlighter";
import { highlightSavedTerms } from "../highlighting/single-pass-highlighter";
import { createLocalRepositories } from "../repositories";
import { createBackgroundServices } from "../services/background-services";
import { createFakeQueryExecutor } from "../services/fake-query-executor";
import { SelectionPopupApp } from "./SelectionPopupApp";

const databaseName = "local-slice-integration";
const databases: SaltoDatabase[] = [];
let nextId = 0;

function createHighlightScheduler() {
  const idle: (() => void)[] = [];
  const frames: (() => void)[] = [];
  return {
    scheduleIdle(callback: () => void) {
      idle.push(callback);
      return idle.length - 1;
    },
    cancelIdle(handle: number) {
      idle[handle] = () => undefined;
    },
    scheduleFrame(callback: () => void) {
      frames.push(callback);
      return frames.length - 1;
    },
    cancelFrame(handle: number) {
      frames[handle] = () => undefined;
    },
    flush() {
      idle.shift()?.();
      while (frames.length > 0) {
        frames.shift()?.();
      }
    },
  };
}

function createInstance() {
  const database = new SaltoDatabase(databaseName);
  databases.push(database);
  const repositories = createLocalRepositories(database, {
    clock: () => "2026-07-16T00:00:00.000Z",
    createId: () => `item-${++nextId}`
  });
  const enrichmentQueue = {
    wake: vi.fn().mockResolvedValue(undefined),
    recover: vi.fn().mockResolvedValue(undefined),
    retryFailed: vi.fn().mockResolvedValue(undefined)
  };
  const services = createBackgroundServices({
    repositories,
    saveVocabulary: repositories.saveVocabulary,
    enrichmentQueue: enrichmentQueue as never,
    queryExecutor: createFakeQueryExecutor()
  });
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
    const scheduler = createHighlightScheduler();
    const highlightSession = createHighlightSession({
      document,
      async loadSnapshot() {
        const response = await first.services.handleMessage({ type: "list-highlight-terms" });
        if (!response.ok || response.type !== "list-highlight-terms") {
          throw new Error("Highlight snapshot unavailable");
        }
        return {
          enabled: response.data.enabled,
          terms: response.data.terms,
          paths: response.data.paths,
        };
      },
      subscribeSettings: () => () => undefined,
      createScanner(options) {
        return createIncrementalHighlightScanner({
          ...options,
          scheduleIdle: scheduler.scheduleIdle,
          cancelIdle: scheduler.cancelIdle,
          scheduleFrame: scheduler.scheduleFrame,
          cancelFrame: scheduler.cancelFrame,
        });
      },
    });
    highlightSession.start();
    await act(async () => undefined);
    render(
      <SelectionPopupApp
        messageClient={{ send }}
        onSaveSuccess={(term) => highlightSession.addSavedTerm(term)}
      />,
    );

    selectFixtureTerm();
    expect(send.mock.calls.some(([request]) => request.type === "translate-selection"))
      .toBe(false);

    await userEvent.setup().click(screen.getByRole("button", { name: "Open selection panel" }));
    expect(await screen.findByText("Default")).toBeInTheDocument();
    expect(await screen.findByText("Fake translation: unfamiliar -> zh-CN")).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Save selection" }));
    expect(await screen.findByRole("button", { name: "Selection saved" })).toBeDisabled();
    scheduler.flush();
    expect(document.querySelector("[data-salto-highlight]")?.textContent).toBe("unfamiliar");
    highlightSession.teardown();
    first.database.close();
    cleanup();

    document.body.innerHTML = '<main><p id="fixture">An unfamiliar term appears here.</p></main>';
    const reopened = createInstance();
    const response = await reopened.services.handleMessage({ type: "list-highlight-terms" });
    expect(response.ok && response.type === "list-highlight-terms" ? response.data.terms : []).toEqual(["unfamiliar"]);
    if (response.ok && response.type === "list-highlight-terms") {
      highlightSavedTerms(document, response.data.paths);
    }
    expect(document.querySelector("[data-salto-highlight]")?.textContent).toBe("unfamiliar");
  });
});
