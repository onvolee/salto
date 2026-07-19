import { createSavedTermTextNodeHighlighter } from "./single-pass-highlighter";

const DEFAULT_MAX_QUEUE_SIZE = 128;
const DEFAULT_MAX_NODES_PER_BATCH = 48;
const DEFAULT_MAX_NODES_PER_FRAME = 48;

export type IncrementalHighlightDiagnostic = {
  readonly durationMs: number;
  readonly nodeCount: number;
  readonly matchCount: number;
};

type ScheduleCallback = (callback: () => void) => number;
type CancelCallback = (handle: number) => void;

export type IncrementalHighlightScannerOptions = {
  readonly document: Document;
  readonly terms: readonly string[];
  readonly maxQueueSize?: number;
  readonly maxNodesPerBatch?: number;
  readonly maxNodesPerFrame?: number;
  readonly scheduleIdle?: ScheduleCallback;
  readonly cancelIdle?: CancelCallback;
  readonly scheduleFrame?: ScheduleCallback;
  readonly cancelFrame?: CancelCallback;
  readonly onDiagnostic?: (diagnostic: IncrementalHighlightDiagnostic) => void;
};

export type IncrementalHighlightScanner = {
  teardown(): void;
};

type TraversalWork = {
  readonly root: Node;
  readonly walker?: TreeWalker;
  nextText?: Text | null;
  started: boolean;
};

function boundedPositiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || value === undefined || value < 1) {
    return fallback;
  }

  return Math.floor(value);
}

function isSaltoOwnedNode(node: Node): boolean {
  const element = node.nodeType === Node.ELEMENT_NODE
    ? node as Element
    : node.parentElement;
  return Boolean(element?.closest("[data-salto-highlight], salto-selection-popup"));
}

function containsNode(ancestor: Node, node: Node): boolean {
  return ancestor === node || ancestor.contains(node);
}

function commonAncestor(nodes: readonly Node[]): Element | null {
  const first = nodes[0];
  if (!first) {
    return null;
  }

  for (
    let candidate = first.nodeType === Node.ELEMENT_NODE
      ? first as Element
      : first.parentElement;
    candidate;
    candidate = candidate.parentElement
  ) {
    if (nodes.every((node) => containsNode(candidate, node))) {
      return candidate;
    }
  }

  return null;
}

function defaultScheduleIdle(document: Document): ScheduleCallback {
  const view = document.defaultView;
  const idleWindow = view as (Window & {
    requestIdleCallback?: (callback: IdleRequestCallback) => number;
  }) | null;
  if (idleWindow?.requestIdleCallback) {
    return (callback) => idleWindow.requestIdleCallback?.(() => callback()) ?? 0;
  }

  return (callback) => view?.setTimeout(callback, 0) ?? 0;
}

function defaultCancelIdle(document: Document): CancelCallback {
  const view = document.defaultView;
  const idleWindow = view as (Window & {
    cancelIdleCallback?: (handle: number) => void;
  }) | null;
  return (handle) => {
    if (idleWindow?.cancelIdleCallback) {
      idleWindow.cancelIdleCallback(handle);
      return;
    }
    view?.clearTimeout(handle);
  };
}

function defaultScheduleFrame(document: Document): ScheduleCallback {
  return (callback) => document.defaultView?.requestAnimationFrame(callback) ?? 0;
}

function defaultCancelFrame(document: Document): CancelCallback {
  return (handle) => document.defaultView?.cancelAnimationFrame(handle);
}

export function createIncrementalHighlightScanner(
  options: IncrementalHighlightScannerOptions
): IncrementalHighlightScanner {
  const { document, terms } = options;
  if (terms.length === 0) {
    return { teardown: () => undefined };
  }

  const maxQueueSize = boundedPositiveInteger(options.maxQueueSize, DEFAULT_MAX_QUEUE_SIZE);
  const maxNodesPerBatch = boundedPositiveInteger(
    options.maxNodesPerBatch,
    DEFAULT_MAX_NODES_PER_BATCH
  );
  const maxNodesPerFrame = boundedPositiveInteger(
    options.maxNodesPerFrame,
    DEFAULT_MAX_NODES_PER_FRAME
  );
  const maxNodesPerWorkFrame = Math.min(maxNodesPerBatch, maxNodesPerFrame);
  const scheduleIdle = options.scheduleIdle ?? defaultScheduleIdle(document);
  const cancelIdle = options.cancelIdle ?? defaultCancelIdle(document);
  const scheduleFrame = options.scheduleFrame ?? defaultScheduleFrame(document);
  const cancelFrame = options.cancelFrame ?? defaultCancelFrame(document);
  const textNodeHighlighter = createSavedTermTextNodeHighlighter(document, terms);
  const workQueue: TraversalWork[] = [];
  const queuedRoots = new Set<Node>();
  let active = true;
  let idleHandle: number | null = null;
  let frameHandle: number | null = null;

  const addWork = (node: Node) => {
    queuedRoots.add(node);
    workQueue.push({
      root: node,
      walker: node.nodeType === Node.TEXT_NODE
        ? undefined
        : document.createTreeWalker(node, NodeFilter.SHOW_TEXT),
      nextText: node instanceof Text ? node : undefined,
      started: false,
    });
  };

  const removeWork = (work: TraversalWork) => {
    const index = workQueue.indexOf(work);
    if (index >= 0) {
      workQueue.splice(index, 1);
      queuedRoots.delete(work.root);
    }
  };

  const enqueue = (node: Node) => {
    if (!active || isSaltoOwnedNode(node) || queuedRoots.has(node)) {
      return;
    }

    if (node.nodeType !== Node.TEXT_NODE && node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const pendingWork = workQueue.filter((work) => !work.started);
    if (pendingWork.some((work) => containsNode(work.root, node))) {
      return;
    }

    const coveredWork = pendingWork.filter((work) => containsNode(node, work.root));
    for (const work of coveredWork) {
      removeWork(work);
    }

    if (pendingWork.length - coveredWork.length < maxQueueSize) {
      addWork(node);
      return;
    }

    const coalescedRoot = commonAncestor([...pendingWork.map((work) => work.root), node]);
    if (!coalescedRoot || isSaltoOwnedNode(coalescedRoot)) {
      return;
    }

    for (const work of pendingWork) {
      if (containsNode(coalescedRoot, work.root)) {
        removeWork(work);
      }
    }
    addWork(coalescedRoot);
  };

  const scheduleWorkFrame = () => {
    if (active && frameHandle === null && workQueue.length > 0) {
      frameHandle = scheduleFrame(processFrame);
    }
  };

  const processFrame = () => {
    frameHandle = null;
    if (!active) {
      return;
    }

    const startedAt = performance.now();
    const nodes: Text[] = [];
    let inspectedNodeCount = 0;
    while (inspectedNodeCount < maxNodesPerWorkFrame && workQueue.length > 0) {
      const work = workQueue[0];
      if (!work) {
        break;
      }
      if (!work.started) {
        work.started = true;
        queuedRoots.delete(work.root);
      }

      if (work.nextText === undefined) {
        let next: Node | null = null;
        do {
          next = work.walker?.nextNode() ?? null;
        } while (next instanceof Text && isSaltoOwnedNode(next));
        work.nextText = next instanceof Text ? next : null;
      }
      const text = work.nextText;

      if (!text) {
        workQueue.shift();
        continue;
      }

      inspectedNodeCount += 1;
      if (!isSaltoOwnedNode(text)) {
        nodes.push(text);
      }
      if (work.root instanceof Text) {
        work.nextText = null;
        continue;
      }

      // Advance before the frame writes split the current text node. Keeping
      // the next original node as the walker cursor avoids revisiting splits.
      let next: Node | null = null;
      do {
        next = work.walker?.nextNode() ?? null;
      } while (next instanceof Text && isSaltoOwnedNode(next));
      work.nextText = next instanceof Text ? next : null;
    }

    if (inspectedNodeCount > 0 && active) {
      const matchCount = nodes.length > 0 ? textNodeHighlighter.highlight(nodes) : 0;
      // DOM writes synchronously enqueue observer records. They are entirely
      // Salto-owned, so discard them before the next page mutation delivery.
      observer.takeRecords();
      options.onDiagnostic?.({
        durationMs: performance.now() - startedAt,
        nodeCount: inspectedNodeCount,
        matchCount,
      });
    }

    scheduleWorkFrame();
  };

  const observer = new MutationObserver((records) => {
    if (!active) {
      return;
    }

    for (const record of records) {
      if (record.type === "characterData") {
        enqueue(record.target);
        continue;
      }

      for (const node of record.addedNodes) {
        enqueue(node);
      }
    }
    scheduleWorkFrame();
  });

  observer.observe(document.documentElement ?? document, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  idleHandle = scheduleIdle(() => {
    idleHandle = null;
    if (!active || !document.body) {
      return;
    }
    enqueue(document.body);
    scheduleWorkFrame();
  });

  return {
    teardown() {
      if (!active) {
        return;
      }
      active = false;
      observer.disconnect();
      if (idleHandle !== null) {
        cancelIdle(idleHandle);
        idleHandle = null;
      }
      if (frameHandle !== null) {
        cancelFrame(frameHandle);
        frameHandle = null;
      }
      workQueue.splice(0);
      queuedRoots.clear();
    },
  };
}
