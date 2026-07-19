export const DICTIONARY_FIELD_TYPES = {
  phonetic: "text",
  partOfSpeech: "text",
  meaning: "text",
  synonyms: "list",
  wordForms: "list"
} as const;

export type DictionaryFieldKey = keyof typeof DICTIONARY_FIELD_TYPES;
export type DictionaryFieldType = (typeof DICTIONARY_FIELD_TYPES)[DictionaryFieldKey];
export type DictionaryProviderId = "youdao-web" | "cambridge-web";

type DictionaryFieldValueSpec = {
  readonly phonetic: string;
  readonly partOfSpeech: string;
  readonly meaning: string;
  readonly synonyms: readonly string[];
  readonly wordForms: readonly string[];
};

export type DictionaryFieldResultFor<K extends DictionaryFieldKey> =
  | {
      readonly status: "ready";
      readonly type: (typeof DICTIONARY_FIELD_TYPES)[K];
      readonly value: DictionaryFieldValueSpec[K];
    }
  | {
      readonly status: "unavailable";
      readonly type: (typeof DICTIONARY_FIELD_TYPES)[K];
      readonly reason: "missing" | "not-found" | "unsupported";
    };

export type DictionaryFieldResults = {
  readonly [K in DictionaryFieldKey]: DictionaryFieldResultFor<K>;
};

export interface DictionaryLookupRequest {
  readonly term: string;
  readonly language: string;
}

export interface DictionaryLookupResult {
  readonly providerId: DictionaryProviderId;
  readonly term: string;
  readonly language: string;
  readonly fields: DictionaryFieldResults;
}

export interface DictionaryAdapterCapabilities {
  readonly providerId: DictionaryProviderId;
  readonly supportedLanguages: readonly string[];
  readonly supportedFields: readonly DictionaryFieldKey[];
}

export interface DictionaryAdapter {
  readonly capabilities: DictionaryAdapterCapabilities;
  lookup(
    request: DictionaryLookupRequest,
    signal: AbortSignal
  ): Promise<DictionaryLookupResult>;
}

export interface DictionaryClient {
  lookup(
    request: DictionaryLookupRequest,
    signal: AbortSignal
  ): Promise<DictionaryLookupResult>;
}
