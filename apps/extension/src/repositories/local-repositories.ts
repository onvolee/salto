import {
  DEFAULT_EXTENSION_SETTINGS,
  canonicalizeEnglishTerm,
  createDefaultQueryTemplate,
  normalizeVocabularyText,
  type EnrichmentJob,
  type EnrichmentJobFor,
  type EnrichmentJobRepository,
  type EnrichmentJobStatus,
  type ExtensionSettings,
  type LearningCard,
  type LearningCardType,
  type LearningRepository,
  type LlmConfigState,
  type LlmPublicConfig,
  type LlmSecret,
  type QueryTemplate,
  type RemoteVocabularyFieldKey,
  type SaveVocabularyInput,
  type SaveVocabularyResult,
  type SaveVocabularyService,
  type SyncMetadata,
  type VocabularyContext,
  type VocabularyFieldFor,
  type VocabularyItem,
  type VocabularyRepository
} from "@salto/core";
import Dexie from "dexie";

import type { SaltoDatabase, StoredExtensionSettings } from "../db/database";

export type RepositoryDependencies = {
  readonly clock: () => string;
  readonly createId: () => string;
};

export interface SettingsRepository {
  ensureDefaults(): Promise<{ readonly settings: ExtensionSettings; readonly template: QueryTemplate }>;
  getActive(): Promise<{ readonly settings: ExtensionSettings; readonly template: QueryTemplate }>;
}

export interface HighlightTermRepository {
  list(): Promise<readonly string[]>;
}

export interface LlmSettingsRepository {
  getPublicState(): Promise<LlmConfigState>;
  getCredentials(): Promise<{
    readonly config: LlmPublicConfig;
    readonly secret: LlmSecret;
  } | null>;
  save(config: LlmPublicConfig, secret?: LlmSecret): Promise<void>;
}

export type LocalRepositories = {
  readonly vocabulary: VocabularyRepository;
  readonly settings: SettingsRepository;
  readonly highlightTerms: HighlightTermRepository;
  readonly llmSettings: LlmSettingsRepository;
  readonly enrichmentJobs: EnrichmentJobRepository;
  readonly learning: LearningRepository;
  readonly saveVocabulary: SaveVocabularyService;
};

function createSyncMetadata(timestamp: string): SyncMetadata {
  return { createdAt: timestamp, updatedAt: timestamp, recordVersion: 1 };
}

function normalizePageUrl(value: string): string {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }
    url.username = "";
    url.password = "";
    url.hash = "";
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    if (
      (url.protocol === "http:" && url.port === "80")
      || (url.protocol === "https:" && url.port === "443")
    ) {
      url.port = "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

function contextId(vocabularyItemId: string, pageUrl: string, sentence: string): string {
  return `context:${JSON.stringify([vocabularyItemId, pageUrl, sentence])}`;
}

async function addIfAbsent(add: () => Promise<unknown>): Promise<void> {
  try {
    await add();
  } catch (error) {
    if (!(error instanceof Dexie.ConstraintError)) {
      throw error;
    }
  }
}

const REMOTE_FIELD_SOURCES = {
  phonetic: "dictionary",
  partOfSpeech: "dictionary",
  meaning: "dictionary",
  examples: "llm",
  synonyms: "dictionary",
  wordForms: "dictionary"
} as const satisfies Record<RemoteVocabularyFieldKey, "dictionary" | "llm">;

class DexieVocabularyRepository implements VocabularyRepository {
  constructor(private readonly database: SaltoDatabase) {}

  findItemByCanonicalKey(canonicalKey: string): Promise<VocabularyItem | undefined> {
    return this.database.vocabularyItems.where("canonicalKey").equals(canonicalKey).first();
  }

  getItem(id: string): Promise<VocabularyItem | undefined> {
    return this.database.vocabularyItems.get(id);
  }

  listFields(vocabularyItemId: string) {
    return this.database.vocabularyFields.where("vocabularyItemId").equals(vocabularyItemId).toArray();
  }
}

class DexieEnrichmentJobRepository implements EnrichmentJobRepository {
  constructor(private readonly database: SaltoDatabase) {}

  get(id: string): Promise<EnrichmentJob | undefined> {
    return this.database.enrichmentJobs.get(id);
  }

  async listRunnable(limit = 50): Promise<readonly EnrichmentJob[]> {
    const now = new Date().toISOString();
    return this.database.enrichmentJobs
      .where("[status+nextRunAt]")
      .between(["queued", Dexie.minKey], ["queued", now])
      .limit(limit)
      .toArray();
  }

  listQueued(limit = 1000): Promise<readonly EnrichmentJob[]> {
    return this.database.enrichmentJobs.where("status").equals("queued").limit(limit).toArray();
  }

  listRunning(): Promise<readonly EnrichmentJob[]> {
    return this.database.enrichmentJobs.where("status").equals("running").toArray();
  }

  listFailed(limit = 1000): Promise<readonly EnrichmentJob[]> {
    return this.database.enrichmentJobs.where("status").equals("failed").limit(limit).toArray();
  }

  listByVocabularyItem(vocabularyItemId: string): Promise<readonly EnrichmentJob[]> {
    return this.database.enrichmentJobs.where("vocabularyItemId").equals(vocabularyItemId).toArray();
  }

  async save(job: EnrichmentJob): Promise<void> {
    await this.database.enrichmentJobs.put(job);
  }

  async delete(id: string): Promise<void> {
    await this.database.enrichmentJobs.delete(id);
  }

  async updateStatus(
    id: string,
    from: EnrichmentJobStatus,
    to: EnrichmentJobStatus,
    updates?: Partial<Pick<EnrichmentJob, "attempts" | "nextRunAt" | "lastError">>
  ): Promise<EnrichmentJob | undefined> {
    return this.database.transaction("rw", [this.database.enrichmentJobs], async () => {
      const existing = await this.database.enrichmentJobs.get(id);
      if (!existing || existing.status !== from) {
        return undefined;
      }
      const updated = { ...existing, status: to, ...(updates ?? {}) } as EnrichmentJob;
      await this.database.enrichmentJobs.put(updated);
      return updated;
    });
  }
}

class DexieLearningRepository implements LearningRepository {
  constructor(private readonly database: SaltoDatabase) {}

  getCard(id: string): Promise<LearningCard | undefined> {
    return this.database.learningCards.get(id);
  }

  async findCardByItemAndType(
    vocabularyItemId: string,
    cardType: LearningCardType
  ): Promise<LearningCard | undefined> {
    const cards = await this.database.learningCards
      .where("vocabularyItemId")
      .equals(vocabularyItemId)
      .toArray();
    return cards.find((card) => card.cardType === cardType);
  }

  async saveCard(card: LearningCard): Promise<void> {
    await this.database.learningCards.put(card);
  }

  async getState(): Promise<undefined> {
    return undefined;
  }

  async saveState(): Promise<void> {}

  async appendReviewLog(): Promise<void> {}
}

class DexieSaveVocabularyService implements SaveVocabularyService {
  constructor(
    private readonly database: SaltoDatabase,
    private readonly dependencies: RepositoryDependencies
  ) {}

  async save(input: SaveVocabularyInput): Promise<SaveVocabularyResult> {
    const normalized = canonicalizeEnglishTerm(input.term);

    return this.database.transaction(
      "rw",
      [
        this.database.vocabularyItems,
        this.database.vocabularyFields,
        this.database.vocabularyContexts,
        this.database.enrichmentJobs
      ],
      async () => {
        const timestamp = this.dependencies.clock();
        const existing = await this.database.vocabularyItems
          .where("canonicalKey")
          .equals(normalized.canonicalKey)
          .first();
        const item: VocabularyItem = existing ?? {
          id: this.dependencies.createId(),
          canonicalKey: normalized.canonicalKey,
          term: normalized.term,
          language: input.language,
          sync: createSyncMetadata(timestamp)
        };

        if (!existing) {
          await this.database.vocabularyItems.add(item);
        }

        const termFieldId = `${item.id}:term`;
        const existingTermField = await this.database.vocabularyFields.get(termFieldId);
        if (!existingTermField) {
          const termField: VocabularyFieldFor<"term"> = {
            id: termFieldId,
            vocabularyItemId: item.id,
            key: "term",
            source: "system",
            status: "ready",
            value: item.term,
            sync: createSyncMetadata(timestamp)
          };
          await addIfAbsent(() => this.database.vocabularyFields.add(termField));
        }

        for (const [key, source] of Object.entries(REMOTE_FIELD_SOURCES) as Array<
          [RemoteVocabularyFieldKey, "dictionary" | "llm"]
        >) {
          const fieldId = `${item.id}:${key}`;
          const existingField = await this.database.vocabularyFields.get(fieldId);
          if (!existingField) {
            const field = {
              id: fieldId,
              vocabularyItemId: item.id,
              key,
              source,
              status: "pending" as const,
              sync: createSyncMetadata(timestamp)
            } as VocabularyFieldFor<typeof key>;
            await addIfAbsent(() => this.database.vocabularyFields.add(field));
          }

          const currentField = await this.database.vocabularyFields.get(fieldId);
          if (currentField && currentField.status === "pending") {
            const jobId = `${item.id}:${key}:job`;
            const existingJob = await this.database.enrichmentJobs.get(jobId);
            if (!existingJob) {
              const job = {
                id: jobId,
                vocabularyItemId: item.id,
                fieldKey: key,
                source,
                status: "queued" as const,
                attempts: 0,
                nextRunAt: timestamp
              } as EnrichmentJobFor<typeof key>;
              await addIfAbsent(() => this.database.enrichmentJobs.add(job));
            }
          }
        }

        const sentence = normalizeVocabularyText(input.context.sentence);
        const pageUrl = normalizePageUrl(input.context.pageUrl);
        const contextRecordId = contextId(item.id, pageUrl, sentence);
        const existingContext = await this.database.vocabularyContexts.get(contextRecordId);
        if (!existingContext) {
          const context: VocabularyContext = {
            id: contextRecordId,
            vocabularyItemId: item.id,
            sentence,
            paragraphs: normalizeVocabularyText(input.context.paragraphs),
            pageTitle: normalizeVocabularyText(input.context.pageTitle),
            pageUrl,
            savedAt: timestamp,
            sync: createSyncMetadata(timestamp)
          };
          await addIfAbsent(() => this.database.vocabularyContexts.add(context));
        }

        return {
          status: existing ? "already-saved" : "saved",
          vocabularyItemId: item.id
        };
      }
    );
  }
}

class DexieSettingsRepository implements SettingsRepository {
  constructor(
    private readonly database: SaltoDatabase,
    private readonly dependencies: RepositoryDependencies
  ) {}

  async ensureDefaults() {
    return this.database.transaction(
      "rw",
      [this.database.settings, this.database.queryTemplates],
      async () => {
        let settings = await this.database.settings.get("extension");
        if (!settings) {
          settings = { id: "extension", ...DEFAULT_EXTENSION_SETTINGS };
          await this.database.settings.add(settings);
        }

        let template = await this.database.queryTemplates.get(settings.activeQueryTemplateId);
        if (!template) {
          template = createDefaultQueryTemplate(this.dependencies.clock());
          await this.database.queryTemplates.put(template);
          if (settings.activeQueryTemplateId !== template.id) {
            settings = { ...settings, activeQueryTemplateId: template.id };
            await this.database.settings.put(settings);
          }
        }

        return { settings: stripSettingsId(settings), template };
      }
    );
  }

  getActive() {
    return this.ensureDefaults();
  }
}

class DexieLlmSettingsRepository implements LlmSettingsRepository {
  constructor(private readonly database: SaltoDatabase) {}

  async getPublicState(): Promise<LlmConfigState> {
    const [storedConfig, storedSecret] = await Promise.all([
      this.database.llmConfigs.get("active"),
      this.database.llmSecrets.get("active")
    ]);
    if (!storedConfig) {
      return { hasApiKey: false };
    }
    const { id: _id, ...config } = storedConfig;
    return { config, hasApiKey: Boolean(storedSecret?.apiKey) };
  }

  async getCredentials() {
    const [storedConfig, storedSecret] = await Promise.all([
      this.database.llmConfigs.get("active"),
      this.database.llmSecrets.get("active")
    ]);
    if (!storedConfig || !storedSecret?.apiKey) {
      return null;
    }
    const { id: _configId, ...config } = storedConfig;
    const { id: _secretId, ...secret } = storedSecret;
    return { config, secret };
  }

  async save(config: LlmPublicConfig, secret?: LlmSecret): Promise<void> {
    await this.database.transaction(
      "rw",
      [this.database.llmConfigs, this.database.llmSecrets],
      async () => {
        const existingSecret = await this.database.llmSecrets.get("active");
        if (!secret?.apiKey && !existingSecret?.apiKey) {
          throw new Error("An API key is required for the first LLM configuration");
        }
        await this.database.llmConfigs.put({ id: "active", ...config });
        if (secret?.apiKey) {
          await this.database.llmSecrets.put({ id: "active", apiKey: secret.apiKey });
        }
      }
    );
  }
}

function stripSettingsId({ id: _id, ...settings }: StoredExtensionSettings): ExtensionSettings {
  return settings;
}

export function createLocalRepositories(
  database: SaltoDatabase,
  dependencies: RepositoryDependencies
): LocalRepositories {
  return {
    vocabulary: new DexieVocabularyRepository(database),
    settings: new DexieSettingsRepository(database, dependencies),
    llmSettings: new DexieLlmSettingsRepository(database),
    enrichmentJobs: new DexieEnrichmentJobRepository(database),
    learning: new DexieLearningRepository(database),
    saveVocabulary: new DexieSaveVocabularyService(database, dependencies),
    highlightTerms: {
      async list() {
        return (await database.vocabularyItems.orderBy("sync.updatedAt").toArray()).map(
          ({ term }) => term
        );
      }
    }
  };
}
