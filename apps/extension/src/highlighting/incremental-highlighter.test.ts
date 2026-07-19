// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createIncrementalHighlightScanner,
  type IncrementalHighlightDiagnostic,
} from "./incremental-highlighter";

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
    runFrame() {
      frames.shift()?.();
    },
    get pendingFrames() {
      return frames.length;
    },
    get pendingIdle() {
      return idle.length;
    },
  };
}

function drainFrames(scheduler: ReturnType<typeof createScheduler>) {
  while (scheduler.pendingFrames > 0) {
    scheduler.runFrame();
  }
}

describe("incremental highlight scanner", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not schedule page work when there are no saved terms", () => {
    const scheduler = createScheduler();

    createIncrementalHighlightScanner({
      document,
      terms: [],
      scheduleIdle: scheduler.scheduleIdle,
      cancelIdle: scheduler.cancelIdle,
      scheduleFrame: scheduler.scheduleFrame,
      cancelFrame: scheduler.cancelFrame,
    });

    expect(scheduler.pendingIdle).toBe(0);
    scheduler.runIdle();
    expect(scheduler.pendingFrames).toBe(0);
  });

  it("defers the initial scan until idle and bounds long-document work per animation frame", () => {
    const scheduler = createScheduler();
    const diagnostics: IncrementalHighlightDiagnostic[] = [];
    const article = document.createElement("article");
    for (let index = 0; index < 13; index += 1) {
      const paragraph = document.createElement("p");
      paragraph.textContent = `saved fixture ${index}`;
      article.append(paragraph);
    }
    document.body.append(article);

    const scanner = createIncrementalHighlightScanner({
      document,
      terms: ["saved"],
      maxNodesPerBatch: 3,
      maxQueueSize: 8,
      scheduleIdle: scheduler.scheduleIdle,
      cancelIdle: scheduler.cancelIdle,
      scheduleFrame: scheduler.scheduleFrame,
      cancelFrame: scheduler.cancelFrame,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });

    expect(document.querySelectorAll("[data-salto-highlight]")).toHaveLength(0);
    scheduler.runIdle();
    drainFrames(scheduler);

    expect(document.querySelectorAll("[data-salto-highlight]")).toHaveLength(13);
    expect(diagnostics.map((diagnostic) => diagnostic.nodeCount)).toEqual([3, 3, 3, 3, 1]);
    expect(diagnostics.every((diagnostic) => diagnostic.matchCount <= diagnostic.nodeCount)).toBe(true);
    expect(diagnostics.every((diagnostic) => Number.isFinite(diagnostic.durationMs))).toBe(true);
    expect(JSON.stringify(diagnostics)).not.toContain("fixture");
    scanner.teardown();
  });

  it("scans added and moved text incrementally, coalescing duplicate mutation targets", async () => {
    const scheduler = createScheduler();
    const diagnostics: IncrementalHighlightDiagnostic[] = [];
    const scanner = createIncrementalHighlightScanner({
      document,
      terms: ["saved"],
      maxNodesPerBatch: 2,
      maxQueueSize: 4,
      scheduleIdle: scheduler.scheduleIdle,
      cancelIdle: scheduler.cancelIdle,
      scheduleFrame: scheduler.scheduleFrame,
      cancelFrame: scheduler.cancelFrame,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    scheduler.runIdle();
    drainFrames(scheduler);

    const container = document.createElement("section");
    container.textContent = "saved";
    document.body.append(container);
    document.body.append(container);
    await Promise.resolve();
    drainFrames(scheduler);

    expect(container.querySelectorAll("[data-salto-highlight]")).toHaveLength(1);
    expect(diagnostics.at(-1)?.nodeCount).toBe(1);
    scanner.teardown();
  });

  it("ignores mutations caused by Salto wrappers and never writes after teardown", async () => {
    const scheduler = createScheduler();
    const scanner = createIncrementalHighlightScanner({
      document,
      terms: ["saved"],
      scheduleIdle: scheduler.scheduleIdle,
      cancelIdle: scheduler.cancelIdle,
      scheduleFrame: scheduler.scheduleFrame,
      cancelFrame: scheduler.cancelFrame,
    });
    scheduler.runIdle();

    const paragraph = document.createElement("p");
    paragraph.textContent = "saved";
    document.body.append(paragraph);
    await Promise.resolve();
    drainFrames(scheduler);
    await Promise.resolve();

    expect(paragraph.querySelectorAll("[data-salto-highlight]")).toHaveLength(1);
    expect(scheduler.pendingFrames).toBe(0);

    const later = document.createElement("p");
    later.textContent = "saved";
    document.body.append(later);
    await Promise.resolve();
    scanner.teardown();
    drainFrames(scheduler);

    expect(later.querySelectorAll("[data-salto-highlight]")).toHaveLength(0);
  });

  it("coalesces an overflow burst without dropping newly added content", async () => {
    const scheduler = createScheduler();
    const diagnostics: IncrementalHighlightDiagnostic[] = [];
    const scanner = createIncrementalHighlightScanner({
      document,
      terms: ["saved"],
      maxNodesPerBatch: 1,
      maxQueueSize: 2,
      scheduleIdle: scheduler.scheduleIdle,
      cancelIdle: scheduler.cancelIdle,
      scheduleFrame: scheduler.scheduleFrame,
      cancelFrame: scheduler.cancelFrame,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    scheduler.runIdle();
    drainFrames(scheduler);

    for (let index = 0; index < 6; index += 1) {
      const paragraph = document.createElement("p");
      paragraph.textContent = `saved ${index}`;
      document.body.append(paragraph);
    }
    await Promise.resolve();
    drainFrames(scheduler);

    expect(document.querySelectorAll("[data-salto-highlight]")).toHaveLength(6);
    expect(diagnostics.every((diagnostic) => diagnostic.nodeCount <= 1)).toBe(true);
    expect(diagnostics.reduce((total, diagnostic) => total + diagnostic.nodeCount, 0)).toBe(6);
    scanner.teardown();
  });

  it("coalesces pre-idle mutation roots into the initial document work", async () => {
    const scheduler = createScheduler();
    const scanner = createIncrementalHighlightScanner({
      document,
      terms: ["saved"],
      maxNodesPerBatch: 1,
      maxQueueSize: 2,
      scheduleIdle: scheduler.scheduleIdle,
      cancelIdle: scheduler.cancelIdle,
      scheduleFrame: scheduler.scheduleFrame,
      cancelFrame: scheduler.cancelFrame,
    });

    for (let index = 0; index < 4; index += 1) {
      const paragraph = document.createElement("p");
      paragraph.textContent = `saved before idle ${index}`;
      document.body.append(paragraph);
    }
    await Promise.resolve();
    scheduler.runIdle();
    drainFrames(scheduler);

    expect(document.querySelectorAll("[data-salto-highlight]")).toHaveLength(4);
    scanner.teardown();
  });
});
