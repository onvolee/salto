import { normalizeVocabularyText } from "../vocabulary/canonicalization";

export type SavedTerm = {
  readonly canonicalKey: string;
  readonly term: string;
};

export type SavedTermMatch = {
  readonly canonicalKey: string;
  readonly start: number;
  readonly end: number;
};

const ASCII_WORD_CHARACTER = /^[A-Za-z0-9_]$/;
const ASCII_UPPERCASE = /[A-Z]/g;

function foldEnglishAscii(value: string): string {
  return value.replace(ASCII_UPPERCASE, (character) => character.toLowerCase());
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAsciiWordCharacter(character: string | undefined): boolean {
  return Boolean(character && ASCII_WORD_CHARACTER.test(character));
}

function hasEnglishWordBoundaries(text: string, start: number, end: number): boolean {
  return !isAsciiWordCharacter(text[start - 1]) && !isAsciiWordCharacter(text[end]);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function matchLength(match: SavedTermMatch): number {
  return match.end - match.start;
}

function findInsertionIndex(matches: readonly SavedTermMatch[], start: number): number {
  let low = 0;
  let high = matches.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (matches[middle]!.start < start) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

function resolveOverlaps(candidates: readonly SavedTermMatch[]): readonly SavedTermMatch[] {
  const byPriority = [...candidates].sort((left, right) =>
    matchLength(right) - matchLength(left)
    || compareStrings(left.canonicalKey, right.canonicalKey)
    || left.start - right.start
  );
  const selected: SavedTermMatch[] = [];

  for (const candidate of byPriority) {
    const insertionIndex = findInsertionIndex(selected, candidate.start);
    const previous = selected[insertionIndex - 1];
    const next = selected[insertionIndex];

    if ((previous && previous.end > candidate.start) || (next && next.start < candidate.end)) {
      continue;
    }

    selected.splice(insertionIndex, 0, candidate);
  }

  return selected;
}

export function normalizeSavedTerms(terms: readonly string[]): readonly SavedTerm[] {
  const normalized = new Map<string, SavedTerm>();

  for (const value of terms) {
    const term = normalizeVocabularyText(value);
    if (!term) {
      continue;
    }

    const canonicalKey = `en:${term.toLocaleLowerCase("en-US")}`;
    const current = { canonicalKey, term };
    const existing = normalized.get(canonicalKey);

    if (!existing || current.term < existing.term) {
      normalized.set(canonicalKey, current);
    }
  }

  return [...normalized.values()].sort((left, right) => compareStrings(left.canonicalKey, right.canonicalKey));
}

export function findSavedTermMatches(
  text: string,
  terms: readonly string[]
): readonly SavedTermMatch[] {
  const foldedText = foldEnglishAscii(text);
  const matches: SavedTermMatch[] = [];

  for (const term of normalizeSavedTerms(terms)) {
    const pattern = new RegExp(escapeRegexLiteral(foldEnglishAscii(term.term)), "g");

    for (const found of foldedText.matchAll(pattern)) {
      const start = found.index;
      const end = start + found[0].length;

      if (hasEnglishWordBoundaries(text, start, end)) {
        matches.push({ canonicalKey: term.canonicalKey, start, end });
      }
    }
  }

  return resolveOverlaps(matches);
}
