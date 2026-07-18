import Dexie, { type EntityTable } from "dexie";

import type {
  EnrichmentJob,
  ExtensionSettings,
  LearningCard,
  LlmPublicConfig,
  LlmSecret,
  QueryTemplate,
  VocabularyContext,
  VocabularyField,
  VocabularyItem
} from "@salto/core";

export type StoredExtensionSettings = ExtensionSettings & {
  readonly id: "extension";
  readonly legacySettingsMigrationCompleted?: true;
  readonly activeQueryTemplateRecovery?: "active-template-unavailable";
};
export type StoredLlmConfig = LlmPublicConfig & { readonly id: "active" };
export type StoredLlmSecret = LlmSecret & { readonly id: "active" };

export class SaltoDatabase extends Dexie {
  vocabularyItems!: EntityTable<VocabularyItem, "id">;
  vocabularyFields!: EntityTable<VocabularyField, "id">;
  vocabularyContexts!: EntityTable<VocabularyContext, "id">;
  enrichmentJobs!: EntityTable<EnrichmentJob, "id">;
  learningCards!: EntityTable<LearningCard, "id">;
  queryTemplates!: EntityTable<QueryTemplate, "id">;
  settings!: EntityTable<StoredExtensionSettings, "id">;
  llmConfigs!: EntityTable<StoredLlmConfig, "id">;
  llmSecrets!: EntityTable<StoredLlmSecret, "id">;

  constructor(name = "salto") {
    super(name);

    this.version(1).stores({
      vocabularyItems: "&id, canonicalKey, language, sync.updatedAt",
      vocabularyFields: "&id, vocabularyItemId, key, status, sync.updatedAt",
      vocabularyContexts: "&id, vocabularyItemId, savedAt, sync.updatedAt",
      learningCards: "&id, vocabularyItemId, cardType, sync.updatedAt",
      learningStates: "&id, learningCardId, dueAt, state, sync.updatedAt",
      reviewLogs: "&id, learningCardId, reviewedAt, sync.updatedAt"
    });

    this.version(2).stores({
      vocabularyItems: "&id, &canonicalKey, language, sync.updatedAt",
      vocabularyFields: "&id, &[vocabularyItemId+key], vocabularyItemId, key, status, sync.updatedAt",
      vocabularyContexts: "&id, vocabularyItemId, pageUrl, savedAt, sync.updatedAt",
      queryTemplates: "&id, updatedAt",
      settings: "&id, activeQueryTemplateId"
    });

    this.version(3).stores({
      llmConfigs: "&id, provider",
      llmSecrets: "&id"
    });

    this.version(4).stores({
      enrichmentJobs: "&id, [status+nextRunAt], vocabularyItemId, fieldKey"
    });

    this.version(5).stores({
      learningCards: "&id, &[vocabularyItemId+cardType], vocabularyItemId, cardType, sync.updatedAt"
    });

    this.version(6).stores({
      vocabularyContexts: "&id, vocabularyItemId, pageUrl, savedAt, sync.updatedAt, selectionPath"
    });

    this.version(7).stores({
      queryTemplates: "&id, updatedAt",
      settings: "&id, activeQueryTemplateId"
    }).upgrade(async (transaction) => {
      await transaction.table("settings").toCollection().modify((record: Record<string, unknown>) => {
        if (typeof record.activeQueryTemplateId !== "string" && typeof record.activeTemplateId === "string") {
          record.activeQueryTemplateId = record.activeTemplateId;
        }
      });
    });
  }
}
