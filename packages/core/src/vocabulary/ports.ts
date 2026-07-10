import type { ClientGeneratedId } from "../shared/sync";
import type { VocabularyContext, VocabularyField, VocabularyItem } from "./types";

export interface SaveVocabularyInput {
  readonly term: string;
  readonly language: string;
  readonly context?: Omit<VocabularyContext, "id" | "vocabularyItemId" | "sync">;
}

export interface VocabularyRepository {
  findItemByCanonicalKey(canonicalKey: string): Promise<VocabularyItem | undefined>;
  getItem(id: ClientGeneratedId): Promise<VocabularyItem | undefined>;
  listFields(vocabularyItemId: ClientGeneratedId): Promise<readonly VocabularyField[]>;
  saveItem(item: VocabularyItem): Promise<void>;
  saveField(field: VocabularyField): Promise<void>;
  saveContext(context: VocabularyContext): Promise<void>;
}
