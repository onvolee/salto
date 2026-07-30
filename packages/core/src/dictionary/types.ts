import type { YoudaoPreview } from "../messages";

export const DICTIONARY_FIELD_TYPES = {
  basicDefinition: "text",
  phonetic: "text",
  partOfSpeech: "text",
  meaning: "text",
  synonyms: "list",
  wordForms: "list",
  examples: "examples",
} as const;

export type DictionaryFieldKey = keyof typeof DICTIONARY_FIELD_TYPES;
export type DictionaryFieldType = (typeof DICTIONARY_FIELD_TYPES)[DictionaryFieldKey];
export type DictionaryProviderId = "youdao-web" | "cambridge-web";

export type DictionaryExample = {
  readonly english: string;
  readonly chinese?: string;
  readonly source?: string;
};

export function isDictionaryExample(value: unknown): value is DictionaryExample {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const example = value as Record<string, unknown>;
  return typeof example.english === "string"
    && example.english.trim().length > 0
    && (example.chinese === undefined
      || (typeof example.chinese === "string" && example.chinese.trim().length > 0))
    && (example.source === undefined
      || (typeof example.source === "string" && example.source.trim().length > 0));
}

type DictionaryFieldValueSpec = {
  readonly basicDefinition: string;
  readonly phonetic: string;
  readonly partOfSpeech: string;
  readonly meaning: string;
  readonly synonyms: readonly string[];
  readonly wordForms: readonly string[];
  readonly examples: readonly DictionaryExample[];
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

export interface DictionaryPreviewAdapter extends DictionaryAdapter {
  preview(
    request: DictionaryLookupRequest,
    signal: AbortSignal,
  ): Promise<YoudaoPreview>;
}

export interface DictionaryClient {
  lookup(
    request: DictionaryLookupRequest,
    signal: AbortSignal
  ): Promise<DictionaryLookupResult>;
}
