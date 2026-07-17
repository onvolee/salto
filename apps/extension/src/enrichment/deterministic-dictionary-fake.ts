import type { RemoteVocabularyFieldKey, VocabularyFieldKey, VocabularyFieldValue } from "@salto/core";

import type { EnrichmentBatchRequest, EnrichmentFieldResult, EnrichmentSource } from "./types";

export type DeterministicDictionaryFakeOptions = {
  readonly failFields?: readonly RemoteVocabularyFieldKey[];
};

export function createDeterministicDictionaryFake(
  options: DeterministicDictionaryFakeOptions = {}
): EnrichmentSource {
  return {
    async executeBatch(request: EnrichmentBatchRequest): Promise<readonly EnrichmentFieldResult[]> {
      return request.jobs
        .filter((job) => job.source === "dictionary")
        .map((job) => {
          if (options.failFields?.includes(job.fieldKey)) {
            return {
              jobId: job.id,
              fieldKey: job.fieldKey,
              status: "failed" as const,
              errorMessage: "Deterministic dictionary failure"
            };
          }

          const value = deterministicValue(request.term, job.fieldKey);
          if (value === undefined) {
            return {
              jobId: job.id,
              fieldKey: job.fieldKey,
              status: "unavailable" as const
            };
          }

          return {
            jobId: job.id,
            fieldKey: job.fieldKey,
            status: "ready" as const,
            value
          };
        });
    }
  };
}

function deterministicValue(
  term: string,
  fieldKey: VocabularyFieldKey
): VocabularyFieldValue | undefined {
  switch (fieldKey) {
    case "phonetic":
      return `/${term}/`;
    case "partOfSpeech":
      return "noun";
    case "meaning":
      return `(dictionary) ${term}`;
    case "synonyms":
      return [`${term}-synonym-1`, `${term}-synonym-2`];
    case "wordForms":
      return [`${term}s`, `${term}ing`];
    default:
      return undefined;
  }
}
