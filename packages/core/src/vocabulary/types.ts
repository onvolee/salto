import type { ClientGeneratedId, IsoDateTimeString, SyncMetadata } from "../shared/sync";

export const VOCABULARY_FIELD_KEYS = [
  "term",
  "phonetic",
  "partOfSpeech",
  "meaning",
  "examples",
  "synonyms",
  "wordForms"
] as const;

export type VocabularyFieldKey = (typeof VOCABULARY_FIELD_KEYS)[number];
export type VocabularyFieldStatus = "pending" | "ready" | "failed";
export type VocabularyFieldSource = "system" | "llm" | "youdao-web" | "cambridge-web";

export interface VocabularyItem {
  readonly id: ClientGeneratedId;
  readonly canonicalKey: string;
  readonly language: string;
  readonly term: string;
  readonly sync: SyncMetadata;
}

export interface VocabularyField {
  readonly id: ClientGeneratedId;
  readonly vocabularyItemId: ClientGeneratedId;
  readonly key: VocabularyFieldKey;
  readonly source: VocabularyFieldSource;
  readonly status: VocabularyFieldStatus;
  readonly value?: string;
  readonly errorMessage?: string;
  readonly sync: SyncMetadata;
}

export interface VocabularyContext {
  readonly id: ClientGeneratedId;
  readonly vocabularyItemId: ClientGeneratedId;
  readonly sentence?: string;
  readonly paragraph?: string;
  readonly pageTitle?: string;
  readonly pageUrl?: string;
  readonly savedAt: IsoDateTimeString;
  readonly sync: SyncMetadata;
}
