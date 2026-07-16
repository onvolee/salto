const MAX_TERM_LENGTH = 500;
const WHITESPACE_PATTERN = /\s+/gu;

export function normalizeVocabularyText(value: string): string {
  return value.normalize("NFKC").trim().replace(WHITESPACE_PATTERN, " ");
}

export function canonicalizeEnglishTerm(value: string): {
  readonly canonicalKey: string;
  readonly term: string;
} {
  if (value.length > MAX_TERM_LENGTH) {
    throw new Error("selection-too-long");
  }

  const term = normalizeVocabularyText(value);
  if (!term) {
    throw new Error("invalid-term");
  }

  return {
    canonicalKey: `en:${term.toLocaleLowerCase("en-US")}`,
    term
  };
}
