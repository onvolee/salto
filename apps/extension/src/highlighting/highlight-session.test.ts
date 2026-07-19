// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_EXTENSION_SETTINGS, type ExtensionSettings } from "@salto/core";

import {
  createIncrementalHighlightScanner,
} from "./incremental-highlighter";
import { createHighlightSession } from "./highlight-session";

type ScheduledCallback = () => void;

function createScheduler() {
  const idle: ScheduledCallback[] = [];
  const frames: ScheduledCallback[] = [];
  return {
    scheduleIdle(callback: ScheduledCallback) {
      idle.push(callback);
      return idle.length - 1;
    },
    cancelIdle(handle: number) {
      idle[handle] = () => undefined;
    },
    scheduleFrame(callback: ScheduledCallback) {
      frames.push(callback);
      return frames.length - 1;
    },
    cancelFrame(handle: number) {
      frames[handle] = () => undefined;
    },
    runIdle() {
      idle.shift()?.();
    },
    drainFrames() {
      while (frames.length > 0) {
        frames.shift()?.();
      }
    },
  };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("highlight session", () => {
  beforeEach(() => {
    document.body.innerHTML = "<main><p>known saved restarted</p></main>";
  });

  it("uses startup and re-enable snapshots, adds only successful saved terms, and tears down", async () => {
    const scheduler = createScheduler();
    const snapshots = [
      { enabled: true, terms: ["known"] },
      { enabled: true, terms: ["known", "saved", "restarted"] },
    ];
    let settingsListener: ((settings: ExtensionSettings) => void) | undefined;
    let unsubscribeCalls = 0;
    let scannerStarts = 0;
    const session = createHighlightSession({
      document,
      loadSnapshot: async () => snapshots.shift() ?? { enabled: true, terms: [] },
      subscribeSettings(listener) {
        settingsListener = listener;
        return () => {
          unsubscribeCalls += 1;
          settingsListener = undefined;
        };
      },
      createScanner(options) {
        scannerStarts += 1;
        return createIncrementalHighlightScanner({
          ...options,
          scheduleIdle: scheduler.scheduleIdle,
          cancelIdle: scheduler.cancelIdle,
          scheduleFrame: scheduler.scheduleFrame,
          cancelFrame: scheduler.cancelFrame,
        });
      },
    });

    session.start();
    await settle();
    scheduler.runIdle();
    scheduler.drainFrames();
    expect(document.querySelectorAll("[data-salto-highlight]")).toHaveLength(1);

    session.addSavedTerm("saved");
    scheduler.runIdle();
    scheduler.drainFrames();
    expect(document.querySelectorAll("[data-salto-highlight]")).toHaveLength(2);
    expect(scannerStarts).toBe(2);

    session.addSavedTerm("saved");
    expect(scannerStarts).toBe(2);
    session.addSavedTerm("  SAVED  ");
    session.addSavedTerm("ＳＡＶＥＤ");
    expect(scannerStarts).toBe(2);

    settingsListener?.({ ...DEFAULT_EXTENSION_SETTINGS, highlightEnabled: false });
    expect(document.querySelectorAll("[data-salto-highlight]")).toHaveLength(0);
    const disabledDynamic = document.createElement("p");
    disabledDynamic.textContent = "saved";
    document.body.append(disabledDynamic);
    await settle();
    scheduler.drainFrames();
    expect(disabledDynamic.querySelector("[data-salto-highlight]")).toBeNull();

    settingsListener?.({ ...DEFAULT_EXTENSION_SETTINGS, highlightEnabled: true });
    await settle();
    scheduler.runIdle();
    scheduler.drainFrames();
    expect(document.querySelectorAll("[data-salto-highlight]")).toHaveLength(4);

    const dynamic = document.createElement("p");
    dynamic.textContent = "saved";
    document.body.append(dynamic);
    await settle();
    scheduler.drainFrames();
    expect(dynamic.querySelector("[data-salto-highlight]")).not.toBeNull();

    session.teardown();
    const afterTeardown = document.createElement("p");
    afterTeardown.textContent = "saved";
    document.body.append(afterTeardown);
    await settle();
    scheduler.drainFrames();
    expect(afterTeardown.querySelector("[data-salto-highlight]")).toBeNull();
    expect(unsubscribeCalls).toBe(1);
  });

  it("restores wrappers before rescanning so a newly saved longer term wins", async () => {
    document.body.innerHTML = "<p>new york</p>";
    const scheduler = createScheduler();
    const session = createHighlightSession({
      document,
      loadSnapshot: async () => ({ enabled: true, terms: ["new"] }),
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

    session.start();
    await settle();
    scheduler.runIdle();
    scheduler.drainFrames();
    expect(document.querySelector("[data-salto-highlight]")?.textContent).toBe("new");

    session.addSavedTerm("new york");
    scheduler.runIdle();
    scheduler.drainFrames();

    expect(document.querySelectorAll("[data-salto-highlight]")).toHaveLength(1);
    expect(document.querySelector("[data-salto-highlight]")?.textContent).toBe("new york");
    session.teardown();
  });
});
