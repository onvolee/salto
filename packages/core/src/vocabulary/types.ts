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
export type VocabularyFieldValue = string | readonly string[];
export type VocabularyFieldValueType = "text" | "list";
export type VocabularyFieldSource = "system" | "dictionary" | "llm";

export type VocabularyFieldSpec = {
  readonly term: { readonly value: string; readonly source: "system" };
  readonly phonetic: { readonly value: string; readonly source: "dictionary" };
  readonly partOfSpeech: { readonly value: string; readonly source: "dictionary" };
  readonly meaning: { readonly value: string; readonly source: "dictionary" };
  readonly examples: { readonly value: readonly string[]; readonly source: "llm" };
  readonly synonyms: { readonly value: readonly string[]; readonly source: "dictionary" };
  readonly wordForms: { readonly value: readonly string[]; readonly source: "dictionary" };
};

export interface VocabularyItem {
  readonly id: ClientGeneratedId;
  readonly canonicalKey: string;
  readonly language: "en";
  readonly term: string;
  readonly sync: SyncMetadata;
}

type VocabularyFieldBase<K extends VocabularyFieldKey> = {
  readonly id: ClientGeneratedId;
  readonly vocabularyItemId: ClientGeneratedId;
  readonly key: K;
  readonly source: VocabularyFieldSpec[K]["source"];
  readonly sync: SyncMetadata;
};

export type VocabularyFieldFor<K extends VocabularyFieldKey> =
  | (VocabularyFieldBase<K> & {
      readonly status: "pending";
      readonly value?: never;
      readonly errorMessage?: never;
    })
  | (VocabularyFieldBase<K> & {
      readonly status: "ready";
      readonly value: VocabularyFieldSpec[K]["value"];
      readonly errorMessage?: never;
    })
  | (VocabularyFieldBase<K> & {
      readonly status: "failed";
      readonly value?: never;
      readonly errorMessage: string;
    });

export type VocabularyField = {
  [K in VocabularyFieldKey]: VocabularyFieldFor<K>;
}[VocabularyFieldKey];

export interface VocabularyContext {
  readonly id: ClientGeneratedId;
  readonly vocabularyItemId: ClientGeneratedId;
  readonly sentence: string;
  readonly paragraphs: string;
  readonly pageTitle: string;
  readonly pageUrl: string;
  readonly savedAt: IsoDateTimeString;
  readonly sync: SyncMetadata;
}
