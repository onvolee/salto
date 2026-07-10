import Dexie, { type Table } from "dexie";

import type {
  LearningCard,
  LearningState,
  ReviewLog,
  VocabularyContext,
  VocabularyField,
  VocabularyItem
} from "@salto/core";

export interface SaltoDatabaseTables {
  readonly vocabularyItems: Table<VocabularyItem, string>;
  readonly vocabularyFields: Table<VocabularyField, string>;
  readonly vocabularyContexts: Table<VocabularyContext, string>;
  readonly learningCards: Table<LearningCard, string>;
  readonly learningStates: Table<LearningState, string>;
  readonly reviewLogs: Table<ReviewLog, string>;
}

export class SaltoDatabase extends Dexie implements SaltoDatabaseTables {
  vocabularyItems!: Table<VocabularyItem, string>;
  vocabularyFields!: Table<VocabularyField, string>;
  vocabularyContexts!: Table<VocabularyContext, string>;
  learningCards!: Table<LearningCard, string>;
  learningStates!: Table<LearningState, string>;
  reviewLogs!: Table<ReviewLog, string>;

  constructor() {
    super("salto");

    this.version(1).stores({
      vocabularyItems: "&id, canonicalKey, language, sync.updatedAt",
      vocabularyFields: "&id, vocabularyItemId, key, status, sync.updatedAt",
      vocabularyContexts: "&id, vocabularyItemId, savedAt, sync.updatedAt",
      learningCards: "&id, vocabularyItemId, cardType, sync.updatedAt",
      learningStates: "&id, learningCardId, dueAt, state, sync.updatedAt",
      reviewLogs: "&id, learningCardId, reviewedAt, sync.updatedAt"
    });
  }
}
