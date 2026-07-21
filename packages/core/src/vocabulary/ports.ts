import type { ClientGeneratedId } from "../shared/sync";
import type { EnrichmentJob, EnrichmentJobStatus, RemoteVocabularyFieldKey } from "./types";
import type { VocabularyContext, VocabularyField, VocabularyItem } from "./types";

export interface SaveVocabularyInput {
  readonly term: string;
  readonly language: "en";
  readonly context: Pick<
    VocabularyContext,
    "sentence" | "paragraphs" | "pageTitle" | "pageUrl" | "selectionPath"
  >;
}

export type SaveVocabularyResult = {
  readonly status: "saved" | "already-saved";
  readonly vocabularyItemId: ClientGeneratedId;
};

export interface VocabularyRepository {
  exists(term: string, language: string): Promise<boolean>;
  findItemByCanonicalKey(canonicalKey: string): Promise<VocabularyItem | undefined>;
  getItem(id: ClientGeneratedId): Promise<VocabularyItem | undefined>;
  listFields(vocabularyItemId: ClientGeneratedId): Promise<readonly VocabularyField[]>;
}

export interface EnrichmentJobRepository {
  get(id: ClientGeneratedId): Promise<EnrichmentJob | undefined>;
  listRunnable(limit?: number): Promise<readonly EnrichmentJob[]>;
  listQueued(limit?: number): Promise<readonly EnrichmentJob[]>;
  listRunning(): Promise<readonly EnrichmentJob[]>;
  listFailed(limit?: number): Promise<readonly EnrichmentJob[]>;
  listByVocabularyItem(vocabularyItemId: ClientGeneratedId): Promise<readonly EnrichmentJob[]>;
  save(job: EnrichmentJob): Promise<void>;
  delete(id: ClientGeneratedId): Promise<void>;
  updateStatus(
    id: ClientGeneratedId,
    from: EnrichmentJobStatus,
    to: EnrichmentJobStatus,
    updates?: Partial<Pick<EnrichmentJob, "attempts" | "nextRunAt" | "lastError">>
  ): Promise<EnrichmentJob | undefined>;
}
