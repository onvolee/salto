import type { ClientGeneratedId } from "../shared/sync";
import type { VocabularyContext, VocabularyField, VocabularyItem } from "./types";

export interface SaveVocabularyInput {
  readonly term: string;
  readonly language: "en";
  readonly context: Pick<
    VocabularyContext,
    "sentence" | "paragraphs" | "pageTitle" | "pageUrl"
  >;
}

export type SaveVocabularyResult = {
  readonly status: "saved" | "already-saved";
  readonly vocabularyItemId: ClientGeneratedId;
};

export interface VocabularyRepository {
  save(input: SaveVocabularyInput): Promise<SaveVocabularyResult>;
  findItemByCanonicalKey(canonicalKey: string): Promise<VocabularyItem | undefined>;
  getItem(id: ClientGeneratedId): Promise<VocabularyItem | undefined>;
  listFields(vocabularyItemId: ClientGeneratedId): Promise<readonly VocabularyField[]>;
}
