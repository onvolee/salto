import { normalizeSavedTerms, type ExtensionSettings } from "@salto/core";

import {
  createIncrementalHighlightScanner,
  type IncrementalHighlightScanner,
} from "./incremental-highlighter";
import { cleanupSavedTermHighlights } from "./single-pass-highlighter";

export type HighlightSnapshot = {
  readonly enabled: boolean;
  readonly terms: readonly string[];
};

type ScannerFactory = (options: {
  readonly document: Document;
  readonly terms: readonly string[];
}) => IncrementalHighlightScanner;

export type HighlightSessionDependencies = {
  readonly document: Document;
  readonly loadSnapshot: () => Promise<HighlightSnapshot>;
  readonly subscribeSettings: (
    listener: (settings: ExtensionSettings) => void,
  ) => () => void;
  readonly createScanner?: ScannerFactory;
};

export type HighlightSession = {
  start(): void;
  addSavedTerm(term: string): void;
  teardown(): void;
};

export function createHighlightSession(
  dependencies: HighlightSessionDependencies,
): HighlightSession {
  const createScanner = dependencies.createScanner ?? createIncrementalHighlightScanner;
  const terms = new Map<string, string>();
  const locallySavedTerms = new Map<string, string>();
  let active = false;
  let highlightEnabled: boolean | undefined;
  let snapshotGeneration = 0;
  let scanner: IncrementalHighlightScanner | undefined;
  let unsubscribeSettings: (() => void) | undefined;

  const stopScanner = () => {
    scanner?.teardown();
    scanner = undefined;
  };

  const startScanner = () => {
    stopScanner();
    cleanupSavedTermHighlights(dependencies.document);
    if (active && highlightEnabled && terms.size > 0) {
      scanner = createScanner({ document: dependencies.document, terms: [...terms.values()] });
    }
  };

  const disable = () => {
    highlightEnabled = false;
    snapshotGeneration += 1;
    stopScanner();
    cleanupSavedTermHighlights(dependencies.document);
  };

  const loadSnapshot = () => {
    const generation = ++snapshotGeneration;
    void dependencies.loadSnapshot().then((snapshot) => {
      if (!active || generation !== snapshotGeneration) {
        return;
      }
      if (!snapshot.enabled) {
        disable();
        return;
      }

      highlightEnabled = true;
      terms.clear();
      for (const term of normalizeSavedTerms(snapshot.terms)) {
        terms.set(term.canonicalKey, term.term);
      }
      for (const [canonicalKey, term] of locallySavedTerms) {
        terms.set(canonicalKey, term);
      }
      startScanner();
    }).catch(() => {
      // Highlighting remains inactive when the background snapshot is unavailable.
    });
  };

  return {
    start() {
      if (active) {
        return;
      }
      active = true;
      unsubscribeSettings = dependencies.subscribeSettings((settings) => {
        if (!settings.highlightEnabled) {
          disable();
          return;
        }
        if (highlightEnabled !== true) {
          highlightEnabled = true;
          loadSnapshot();
        }
      });
      loadSnapshot();
    },

    addSavedTerm(term) {
      const normalized = normalizeSavedTerms([term])[0];
      if (!normalized || terms.has(normalized.canonicalKey)) {
        return;
      }
      locallySavedTerms.set(normalized.canonicalKey, normalized.term);
      terms.set(normalized.canonicalKey, normalized.term);
      if (active && highlightEnabled) {
        startScanner();
      }
    },

    teardown() {
      if (!active) {
        return;
      }
      active = false;
      snapshotGeneration += 1;
      unsubscribeSettings?.();
      unsubscribeSettings = undefined;
      stopScanner();
    },
  };
}
