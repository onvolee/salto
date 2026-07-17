import type { EnrichmentJob, VocabularyFieldKey, VocabularyFieldValue } from "@salto/core";

export type EnrichmentFieldResultStatus = "ready" | "unavailable" | "failed";

export interface EnrichmentFieldResult {
  readonly jobId: string;
  readonly fieldKey: VocabularyFieldKey;
  readonly status: EnrichmentFieldResultStatus;
  readonly value?: VocabularyFieldValue;
  readonly errorMessage?: string;
}

export interface EnrichmentBatchRequest {
  readonly vocabularyItemId: string;
  readonly term: string;
  readonly language: "en";
  readonly jobs: readonly EnrichmentJob[];
}

export interface EnrichmentSource {
  executeBatch(request: EnrichmentBatchRequest): Promise<readonly EnrichmentFieldResult[]>;
}
