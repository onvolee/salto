import {
  DICTIONARY_FIELD_TYPES,
  type DictionaryAdapter,
  type DictionaryAdapterCapabilities,
  type DictionaryClient,
  type DictionaryFieldKey,
  type DictionaryFieldResults,
  type DictionaryLookupRequest,
  type DictionaryLookupResult,
  type DictionaryProviderId
} from "./types";
import { DictionaryLookupError } from "./errors";
import type { DictionaryLookupErrorCode } from "./errors";

export type DictionaryFixtureFields = Partial<{
  readonly phonetic: string;
  readonly partOfSpeech: string;
  readonly meaning: string;
  readonly synonyms: readonly string[];
  readonly wordForms: readonly string[];
}>;

export type DictionaryFixture =
  | {
      readonly request: DictionaryLookupRequest;
      readonly fields: DictionaryFixtureFields;
      readonly failure?: never;
    }
  | {
      readonly request: DictionaryLookupRequest;
      readonly fields?: never;
      readonly failure: DictionaryLookupErrorCode;
    };

export interface FakeDictionaryAdapterOptions {
  readonly providerId: DictionaryProviderId;
  readonly supportedLanguages: readonly string[];
  readonly supportedFields?: readonly DictionaryFieldKey[];
  readonly fixtures: readonly DictionaryFixture[];
}

const ALL_DICTIONARY_FIELDS = Object.keys(DICTIONARY_FIELD_TYPES) as DictionaryFieldKey[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDictionaryFieldKey(value: string): value is DictionaryFieldKey {
  return value in DICTIONARY_FIELD_TYPES;
}

function parserFailure(): never {
  throw new DictionaryLookupError("parser-failure");
}

function normalizeTextField(
  fields: Record<string, unknown>,
  field: "phonetic" | "partOfSpeech" | "meaning",
  supported: ReadonlySet<DictionaryFieldKey>,
  missingReason: "missing" | "not-found"
) {
  if (!supported.has(field)) {
    return { status: "unavailable", type: "text", reason: "unsupported" } as const;
  }
  const value = fields[field];
  if (value === undefined) {
    return { status: "unavailable", type: "text", reason: missingReason } as const;
  }
  if (typeof value !== "string") {
    return parserFailure();
  }
  return { status: "ready", type: "text", value } as const;
}

function normalizeListField(
  fields: Record<string, unknown>,
  field: "synonyms" | "wordForms",
  supported: ReadonlySet<DictionaryFieldKey>,
  missingReason: "missing" | "not-found"
) {
  if (!supported.has(field)) {
    return { status: "unavailable", type: "list", reason: "unsupported" } as const;
  }
  const value = fields[field];
  if (value === undefined) {
    return { status: "unavailable", type: "list", reason: missingReason } as const;
  }
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    return parserFailure();
  }
  return { status: "ready", type: "list", value: [...value] } as const;
}

export function normalizeDictionaryFields(
  value: unknown,
  supportedFields: readonly DictionaryFieldKey[],
  options: { readonly missingReason?: "missing" | "not-found" } = {}
): DictionaryFieldResults {
  if (!isRecord(value) || Object.keys(value).some((key) => !isDictionaryFieldKey(key))) {
    return parserFailure();
  }
  const supported = new Set(supportedFields);
  const missingReason = options.missingReason ?? "missing";

  return {
    phonetic: normalizeTextField(value, "phonetic", supported, missingReason),
    partOfSpeech: normalizeTextField(value, "partOfSpeech", supported, missingReason),
    meaning: normalizeTextField(value, "meaning", supported, missingReason),
    synonyms: normalizeListField(value, "synonyms", supported, missingReason),
    wordForms: normalizeListField(value, "wordForms", supported, missingReason)
  };
}

export function createFakeDictionaryAdapter(
  options: FakeDictionaryAdapterOptions
): DictionaryAdapter {
  const supportedFields = options.supportedFields ?? ALL_DICTIONARY_FIELDS;
  const capabilities: DictionaryAdapterCapabilities = {
    providerId: options.providerId,
    supportedLanguages: [...options.supportedLanguages],
    supportedFields: [...supportedFields]
  };

  return {
    capabilities,
    async lookup(request): Promise<DictionaryLookupResult> {
      const fixture = options.fixtures.find((candidate) => (
        candidate.request.term === request.term
        && candidate.request.language === request.language
      ));
      if (fixture?.failure) {
        throw new DictionaryLookupError(fixture.failure);
      }
      const fields = normalizeDictionaryFields(fixture?.fields ?? {}, supportedFields);

      return {
        providerId: options.providerId,
        term: request.term,
        language: request.language,
        fields
      };
    }
  };
}

export function createDictionaryClient(adapter: DictionaryAdapter): DictionaryClient {
  return {
    async lookup(request, signal) {
      if (signal.aborted) {
        throw new DictionaryLookupError("cancelled");
      }
      if (!adapter.capabilities.supportedLanguages.includes(request.language)) {
        throw new DictionaryLookupError("unsupported-language");
      }
      try {
        return await adapter.lookup(request, signal);
      } catch (error) {
        if (error instanceof DictionaryLookupError) {
          throw error;
        }
        if (signal.aborted) {
          throw new DictionaryLookupError("cancelled");
        }
        throw new DictionaryLookupError("parser-failure");
      }
    }
  };
}
