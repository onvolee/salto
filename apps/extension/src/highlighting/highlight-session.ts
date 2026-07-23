import { normalizeSavedTerms, type ExtensionSettings, type SelectionPath } from "@salto/core";

import {
  createIncrementalHighlightScanner,
  type IncrementalHighlightScanner,
} from "./incremental-highlighter";
import { cleanupSavedTermHighlights, highlightSavedTerms } from "./single-pass-highlighter";

export type HighlightSnapshot = {
  readonly enabled: boolean;
  readonly terms: readonly string[];
  readonly paths: readonly {
    readonly term: string;
    readonly path: SelectionPath;
  }[];
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
  const paths = new Map<string, SelectionPath>();
  const locallySavedTerms = new Map<string, string>();
  let active = false;
  let highlightEnabled: boolean | undefined;
  let highlightSameWords: boolean | undefined;
  let snapshotGeneration = 0;
  let scanner: IncrementalHighlightScanner | undefined;
  let unsubscribeSettings: (() => void) | undefined;

  const stopScanner = () => {
    scanner?.teardown();
    scanner = undefined;
  };

  const applyHighlighting = () => {
    stopScanner();
    cleanupSavedTermHighlights(dependencies.document);
    if (!active || !highlightEnabled) {
      return;
    }
    if (highlightSameWords && terms.size > 0) {
      scanner = createScanner({ document: dependencies.document, terms: [...terms.values()] });
    } else if (!highlightSameWords && paths.size > 0) {
      const pathEntries = [...paths.entries()].map(([term, path]) => ({ term, path }));
      highlightSavedTerms(dependencies.document, pathEntries);
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
      paths.clear();
      for (const term of normalizeSavedTerms(snapshot.terms)) {
        terms.set(term.canonicalKey, term.term);
      }
      for (const { term, path } of snapshot.paths) {
        paths.set(term.toLowerCase(), path);
      }
      for (const [canonicalKey, term] of locallySavedTerms) {
        terms.set(canonicalKey, term);
      }
      applyHighlighting();
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
        const sameWordsChanged = highlightSameWords !== settings.highlightSameWords;
        highlightSameWords = settings.highlightSameWords;
        if (highlightEnabled !== true || sameWordsChanged) {
          highlightEnabled = true;
          loadSnapshot();
        }
      });
      highlightSameWords = false;
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
        applyHighlighting();
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
      cleanupSavedTermHighlights(dependencies.document);
    },
  };
}
