import Dexie, { type EntityTable } from "dexie";

import {
  createDefaultTemplateFieldDefinitions,
  isValidQueryTemplate,
  type DictionaryQueryField,
  type EnrichmentJob,
  type ExtensionSettings,
  type LearningCard,
  type LlmPublicConfig,
  type LlmSecret,
  type QueryTemplate,
  type QuerySchemaField,
  type TemplateFieldDefinition,
  type VocabularyContext,
  type VocabularyField,
  type VocabularyItem,
} from "@salto/core";

export type StoredExtensionSettings = ExtensionSettings & {
  readonly id: "extension";
  readonly dictionaryConsentedOrigin?: string;
  readonly legacySettingsMigrationCompleted?: true;
  readonly activeQueryTemplateRecovery?: "active-template-unavailable";
};
export type StoredLlmConfig = LlmPublicConfig & {
  readonly id: "active";
  readonly consentedOrigin?: string;
};
export type StoredLlmSecret = LlmSecret & { readonly id: "active" };

export class SaltoDatabase extends Dexie {
  vocabularyItems!: EntityTable<VocabularyItem, "id">;
  vocabularyFields!: EntityTable<VocabularyField, "id">;
  vocabularyContexts!: EntityTable<VocabularyContext, "id">;
  enrichmentJobs!: EntityTable<EnrichmentJob, "id">;
  learningCards!: EntityTable<LearningCard, "id">;
  queryTemplates!: EntityTable<QueryTemplate, "id">;
  templateFieldDefinitions!: EntityTable<TemplateFieldDefinition, "id">;
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

    this.version(8).stores({
      queryTemplates: "&id, updatedAt",
      templateFieldDefinitions: "&id, source, updatedAt",
      settings: "&id, activeQueryTemplateId"
    }).upgrade(async (transaction) => {
      const templateTable = transaction.table("queryTemplates");
      const definitionTable = transaction.table("templateFieldDefinitions");
      const records = await templateTable.toArray();
      const definitions = new Map<string, TemplateFieldDefinition>();

      for (const record of records) {
        if (isValidQueryTemplate(record)) continue;
        const migrated = migrateLegacyTemplate(record);
        if (!migrated) continue;
        await templateTable.put(migrated.template);
        for (const definition of migrated.definitions) {
          definitions.set(definition.id, definition);
        }
      }

      for (const definition of createDefaultTemplateFieldDefinitions(
        "2000-01-01T00:00:00.000Z",
      )) {
        if (!definitions.has(definition.id)) definitions.set(definition.id, definition);
      }
      await definitionTable.bulkPut([...definitions.values()]);
    });

    this.on("populate", (transaction) => transaction
      .table("templateFieldDefinitions")
      .bulkAdd([...createDefaultTemplateFieldDefinitions("2000-01-01T00:00:00.000Z")]));
  }
}

type LegacyTemplateField = {
  readonly id: string;
  readonly label: string;
  readonly source: "llm" | "dictionary";
  readonly type: "text" | "list";
  readonly instruction?: string;
  readonly dictionaryField?: DictionaryQueryField;
  readonly description?: string;
  readonly order: number;
  readonly enabled: boolean;
  readonly [key: string]: unknown;
};

function migrateLegacyTemplate(value: unknown): {
  readonly template: QueryTemplate;
  readonly definitions: readonly TemplateFieldDefinition[];
} | null {
  if (!isRecord(value)
    || typeof value.id !== "string"
    || typeof value.name !== "string"
    || typeof value.createdAt !== "string"
    || typeof value.updatedAt !== "string"
    || !Array.isArray(value.fields)
    || !value.fields.every(isLegacyTemplateField)
  ) {
    return null;
  }

  const definitions: TemplateFieldDefinition[] = [];
  const fields = value.fields.map((field): QuerySchemaField => {
    const definitionId = migratedDefinitionId(value.id as string, field.id);
    const {
      id,
      label,
      description,
      source,
      type,
      instruction,
      dictionaryField,
      order,
      enabled,
      ...extensions
    } = field;
    const content = source === "llm"
      ? { label, description, source, type, instruction: instruction! }
      : { label, description, source, type, dictionaryField: dictionaryField! };
    definitions.push({
      id: definitionId,
      ...content,
      createdAt: value.createdAt as string,
      updatedAt: value.updatedAt as string,
    } as TemplateFieldDefinition);
    return {
      ...extensions,
      id,
      definitionId,
      content,
      order,
      enabled,
    } as QuerySchemaField;
  });

  return {
    template: { ...value, fields } as unknown as QueryTemplate,
    definitions,
  };
}

function migratedDefinitionId(templateId: string, fieldId: string): string {
  if (templateId === "system-default") {
    const defaultDefinitions = createDefaultTemplateFieldDefinitions("2000-01-01T00:00:00.000Z");
    if (fieldId === "system-default:translation") return defaultDefinitions[0].id;
    if (fieldId === "system-default:key-points") return defaultDefinitions[1].id;
  }
  return `migrated-field:${templateId}:${fieldId}`;
}

function isLegacyTemplateField(value: unknown): value is LegacyTemplateField {
  if (!isRecord(value)
    || typeof value.id !== "string"
    || typeof value.label !== "string"
    || !Number.isInteger(value.order)
    || typeof value.enabled !== "boolean"
    || (value.description !== undefined && typeof value.description !== "string")
  ) {
    return false;
  }
  if (value.source === "llm") {
    return (value.type === "text" || value.type === "list")
      && typeof value.instruction === "string";
  }
  return value.source === "dictionary"
    && (value.type === "text" || value.type === "list")
    && typeof value.dictionaryField === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
