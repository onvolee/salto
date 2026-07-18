import {
  DEFAULT_EXTENSION_SETTINGS,
  canonicalizeEnglishTerm,
  createDefaultQueryTemplate,
  isValidExtensionSettings,
  isValidQueryTemplate,
  isValidQueryTemplateInput,
  normalizeLlmPublicConfig,
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
  type QueryTemplateInput,
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

import type {
  SaltoDatabase,
  StoredExtensionSettings,
  StoredLlmConfig,
} from "../db/database";

export type RepositoryDependencies = {
  readonly clock: () => string;
  readonly createId: () => string;
};

export interface SettingsRepository {
  ensureDefaults(): Promise<{ readonly settings: ExtensionSettings; readonly template: QueryTemplate }>;
  getActive(): Promise<{ readonly settings: ExtensionSettings; readonly template: QueryTemplate }>;
  get(): Promise<ExtensionSettings>;
  getMigrationState(): Promise<{ readonly legacySettingsCompleted: boolean }>;
  save(settings: ExtensionSettings): Promise<ExtensionSettings>;
  saveLegacySettingsMigration(settings: ExtensionSettings): Promise<ExtensionSettings>;
  update(settings: ExtensionSettings): Promise<ExtensionSettings>;
}

export type QueryTemplateRepositoryErrorCode =
  | "template-not-found"
  | "template-protected"
  | "last-template"
  | "template-invalid"
  | "settings-invalid";

export class QueryTemplateRepositoryError extends Error {
  constructor(
    readonly code: QueryTemplateRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "QueryTemplateRepositoryError";
  }
}

export interface QueryTemplateRepository {
  list(): Promise<readonly QueryTemplate[]>;
  get(id: string): Promise<QueryTemplate | undefined>;
  create(input: QueryTemplateInput): Promise<QueryTemplate>;
  copy(id: string): Promise<QueryTemplate>;
  update(template: QueryTemplate): Promise<QueryTemplate>;
  delete(id: string): Promise<void>;
  setDefault(id: string): Promise<{ readonly template: QueryTemplate; readonly activeQueryTemplateId: string }>;
}

export interface HighlightTermRepository {
  list(): Promise<{
    readonly terms: readonly string[];
    readonly paths: readonly {
      readonly term: string;
      readonly path: {
        readonly xpath: string;
        readonly startOffset: number;
        readonly endOffset: number;
      };
    }[];
  }>;
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
  readonly templates: QueryTemplateRepository;
  readonly queryTemplates: QueryTemplateRepository;
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
            selectionPath: input.context.selectionPath,
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

class DexieQueryTemplateRepository implements QueryTemplateRepository, SettingsRepository {
  constructor(
    private readonly database: SaltoDatabase,
    private readonly dependencies: RepositoryDependencies
  ) {}

  async ensureDefaults(): Promise<{ readonly settings: ExtensionSettings; readonly template: QueryTemplate }> {
    return this.database.transaction(
      "rw",
      [this.database.settings, this.database.queryTemplates],
      async () => this.ensureDefaultsInTransaction()
    );
  }

  async getActive(): Promise<{ readonly settings: ExtensionSettings; readonly template: QueryTemplate }> {
    return this.ensureDefaults();
  }

  async get(): Promise<ExtensionSettings>;
  async get(id: string): Promise<QueryTemplate | undefined>;
  async get(id?: string): Promise<ExtensionSettings | QueryTemplate | undefined> {
    if (id !== undefined) {
      if (!isNonEmptyString(id)) {
        return undefined;
      }
      await this.ensureDefaults();
      return this.validTemplate(id);
    }
    return (await this.ensureDefaults()).settings;
  }

  async save(settings: ExtensionSettings): Promise<ExtensionSettings> {
    return this.saveSettings(settings, false);
  }

  async saveLegacySettingsMigration(settings: ExtensionSettings): Promise<ExtensionSettings> {
    return this.saveSettings(settings, true);
  }

  async getMigrationState(): Promise<{ readonly legacySettingsCompleted: boolean }> {
    await this.ensureDefaults();
    const stored = await this.database.settings.get("extension");
    return { legacySettingsCompleted: stored?.legacySettingsMigrationCompleted === true };
  }

  private async saveSettings(
    settings: ExtensionSettings,
    completeLegacySettingsMigration: boolean,
  ): Promise<ExtensionSettings> {
    if (!isValidExtensionSettings(settings)) {
      throw new QueryTemplateRepositoryError("settings-invalid", "Invalid extension settings");
    }
    return this.database.transaction(
      "rw",
      [this.database.settings, this.database.queryTemplates],
      async () => {
        await this.ensureDefaultsInTransaction();
        const template = await this.validTemplate(settings.activeQueryTemplateId);
        if (!template) {
          throw new QueryTemplateRepositoryError("template-not-found", "Query template was not found");
        }
        const current = await this.database.settings.get("extension");
        const stored: StoredExtensionSettings = {
          id: "extension",
          activeQueryTemplateId: settings.activeQueryTemplateId,
          targetLanguage: settings.targetLanguage,
          highlightEnabled: settings.highlightEnabled,
          themeMode: settings.themeMode,
          activeDictionaryProvider: "youdao-web",
          ...(completeLegacySettingsMigration
            || current?.legacySettingsMigrationCompleted === true
            ? { legacySettingsMigrationCompleted: true }
            : {})
        };
        await this.database.settings.put(stored);
        return stripSettingsId(stored);
      }
    );
  }

  update(settings: ExtensionSettings): Promise<ExtensionSettings>;
  update(template: QueryTemplate): Promise<QueryTemplate>;
  update(value: ExtensionSettings | QueryTemplate): Promise<ExtensionSettings | QueryTemplate> {
    return "fields" in value ? this.updateTemplate(value) : this.save(value);
  }

  async list(): Promise<readonly QueryTemplate[]> {
    await this.ensureDefaults();
    const templates = await this.database.queryTemplates.toArray();
    return templates.filter(isValidQueryTemplate);
  }

  async create(input: QueryTemplateInput): Promise<QueryTemplate> {
    if (!isValidQueryTemplateInput(input)) {
      throw new QueryTemplateRepositoryError("template-invalid", "Invalid query template");
    }
    return this.database.transaction(
      "rw",
      [this.database.settings, this.database.queryTemplates],
      async () => {
        await this.ensureDefaultsInTransaction();
        const id = await this.nextTemplateId();
        const timestamp = this.dependencies.clock();
        const template = {
          ...input,
          id,
          createdAt: timestamp,
          updatedAt: timestamp
        } as QueryTemplate;
        await this.database.queryTemplates.add(template);
        return template;
      }
    );
  }

  async copy(id: string): Promise<QueryTemplate> {
    return this.database.transaction(
      "rw",
      [this.database.settings, this.database.queryTemplates],
      async () => {
        await this.ensureDefaultsInTransaction();
        const source = await this.validTemplate(id);
        if (!source) {
          throw new QueryTemplateRepositoryError("template-not-found", "Query template was not found");
        }
        const timestamp = this.dependencies.clock();
        const copy = {
          ...source,
          id: await this.nextTemplateId(),
          name: `${source.name} copy`,
          createdAt: timestamp,
          updatedAt: timestamp
        } as QueryTemplate;
        await this.database.queryTemplates.add(copy);
        return copy;
      }
    );
  }

  private async updateTemplate(template: QueryTemplate): Promise<QueryTemplate> {
    if (!isValidQueryTemplate(template)) {
      throw new QueryTemplateRepositoryError("template-invalid", "Invalid query template");
    }
    return this.database.transaction(
      "rw",
      [this.database.settings, this.database.queryTemplates],
      async () => {
        await this.ensureDefaultsInTransaction();
        if (template.id === "system-default") {
          throw new QueryTemplateRepositoryError("template-protected", "The system template cannot be changed");
        }
        const existing = await this.validTemplate(template.id);
        if (!existing) {
          throw new QueryTemplateRepositoryError("template-not-found", "Query template was not found");
        }
        const updated = {
          ...existing,
          ...template,
          createdAt: existing.createdAt,
          updatedAt: this.dependencies.clock()
        } as QueryTemplate;
        await this.database.queryTemplates.put(updated);
        return updated;
      }
    );
  }

  async delete(id: string): Promise<void> {
    return this.database.transaction(
      "rw",
      [this.database.settings, this.database.queryTemplates],
      async () => {
        const { settings } = await this.ensureDefaultsInTransaction();
        if (id === "system-default") {
          throw new QueryTemplateRepositoryError("template-protected", "The system template cannot be deleted");
        }
        const existing = await this.validTemplate(id);
        if (!existing) {
          throw new QueryTemplateRepositoryError("template-not-found", "Query template was not found");
        }
        const availableTemplates = (await this.database.queryTemplates.toArray()).filter(isValidQueryTemplate);
        if (availableTemplates.length <= 1) {
          throw new QueryTemplateRepositoryError("last-template", "At least one query template must remain");
        }
        await this.database.queryTemplates.delete(id);
        if (settings.activeQueryTemplateId === id) {
          const current = await this.database.settings.get("extension");
          await this.database.settings.put({
            ...current,
            ...settings,
            id: "extension",
            activeQueryTemplateId: "system-default"
          });
        }
      }
    );
  }

  async setDefault(id: string): Promise<{ readonly template: QueryTemplate; readonly activeQueryTemplateId: string }> {
    return this.database.transaction(
      "rw",
      [this.database.settings, this.database.queryTemplates],
      async () => {
        await this.ensureDefaultsInTransaction();
        const template = await this.validTemplate(id);
        if (!template) {
          throw new QueryTemplateRepositoryError("template-not-found", "Query template was not found");
        }
        const settings = await this.database.settings.get("extension");
        if (!settings) {
          throw new QueryTemplateRepositoryError("settings-invalid", "Extension settings are unavailable");
        }
        await this.database.settings.put({
          ...settings,
          activeQueryTemplateId: id
        });
        return { template, activeQueryTemplateId: id };
      }
    );
  }

  private async ensureDefaultsInTransaction() {
    let systemTemplate = await this.database.queryTemplates.get("system-default");
    if (!isValidQueryTemplate(systemTemplate)) {
      systemTemplate = createDefaultQueryTemplate(this.dependencies.clock());
      await this.database.queryTemplates.put(systemTemplate);
    }

    const rawSettings = await this.database.settings.get("extension");
    const settings = normalizeStoredSettings(rawSettings);
    const activeTemplate = await this.validTemplate(settings.activeQueryTemplateId);
    const activeQueryTemplateId = activeTemplate ? settings.activeQueryTemplateId : systemTemplate.id;
    const repairedSettings = {
      ...settings,
      id: "extension" as const,
      activeQueryTemplateId
    };
    await this.database.settings.put(repairedSettings);
    return {
      settings: stripSettingsId(repairedSettings),
      template: activeTemplate ?? systemTemplate
    };
  }

  private async validTemplate(id: string): Promise<QueryTemplate | undefined> {
    const template = await this.database.queryTemplates.get(id);
    return isValidQueryTemplate(template) ? template : undefined;
  }

  private async nextTemplateId(): Promise<string> {
    let id = this.dependencies.createId();
    while (!isNonEmptyString(id) || id === "system-default" || await this.database.queryTemplates.get(id)) {
      id = this.dependencies.createId();
    }
    return id;
  }
}

class DexieLlmSettingsRepository implements LlmSettingsRepository {
  constructor(private readonly database: SaltoDatabase) {}

  async getPublicState(): Promise<LlmConfigState> {
    const [storedConfig, storedSecret] = await Promise.all([
      this.database.llmConfigs.get("active"),
      this.database.llmSecrets.get("active")
    ]);
    const config = normalizeStoredLlmConfig(storedConfig);
    if (!config) {
      return { hasApiKey: isValidApiKey(storedSecret?.apiKey) };
    }
    return { config, hasApiKey: isValidApiKey(storedSecret?.apiKey) };
  }

  async getCredentials() {
    const [storedConfig, storedSecret] = await Promise.all([
      this.database.llmConfigs.get("active"),
      this.database.llmSecrets.get("active")
    ]);
    const config = normalizeStoredLlmConfig(storedConfig);
    if (!config || !isValidApiKey(storedSecret?.apiKey)) {
      return null;
    }
    const { id: _secretId, ...secret } = storedSecret;
    return { config, secret };
  }

  async save(config: LlmPublicConfig, secret?: LlmSecret): Promise<void> {
    const normalizedConfig = normalizeLlmPublicConfig(config).config;
    const nextApiKey = typeof secret?.apiKey === "string" ? secret.apiKey.trim() : "";
    await this.database.transaction(
      "rw",
      [this.database.llmConfigs, this.database.llmSecrets],
      async () => {
        const existingSecret = await this.database.llmSecrets.get("active");
        if (!nextApiKey && !isValidApiKey(existingSecret?.apiKey)) {
          throw new Error("An API key is required for the first LLM configuration");
        }
        await this.database.llmConfigs.put({ id: "active", ...normalizedConfig });
        if (nextApiKey) {
          await this.database.llmSecrets.put({ id: "active", apiKey: nextApiKey });
        }
      }
    );
  }
}

function isValidApiKey(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeStoredLlmConfig(
  stored: StoredLlmConfig | undefined,
): LlmPublicConfig | undefined {
  if (!stored) {
    return undefined;
  }
  const { id: _id, ...config } = stored;
  try {
    return normalizeLlmPublicConfig(config).config;
  } catch {
    return undefined;
  }
}

function normalizeStoredSettings(value: StoredExtensionSettings | undefined): StoredExtensionSettings {
  const raw: Record<string, unknown> = isRecord(value) ? value : {};
  return {
    id: "extension",
    activeQueryTemplateId: isNonEmptyString(raw.activeQueryTemplateId)
      ? raw.activeQueryTemplateId
      : DEFAULT_EXTENSION_SETTINGS.activeQueryTemplateId,
    targetLanguage: isNonEmptyString(raw.targetLanguage)
      ? raw.targetLanguage
      : DEFAULT_EXTENSION_SETTINGS.targetLanguage,
    highlightEnabled: typeof raw.highlightEnabled === "boolean"
      ? raw.highlightEnabled
      : DEFAULT_EXTENSION_SETTINGS.highlightEnabled,
    themeMode: raw.themeMode === "system" || raw.themeMode === "light" || raw.themeMode === "dark"
      ? raw.themeMode
      : DEFAULT_EXTENSION_SETTINGS.themeMode,
    activeDictionaryProvider: "youdao-web",
    ...(raw.legacySettingsMigrationCompleted === true
      ? { legacySettingsMigrationCompleted: true }
      : {})
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stripSettingsId({ id: _id, ...settings }: StoredExtensionSettings): ExtensionSettings {
  return {
    activeQueryTemplateId: settings.activeQueryTemplateId,
    targetLanguage: settings.targetLanguage,
    highlightEnabled: settings.highlightEnabled,
    themeMode: settings.themeMode,
    activeDictionaryProvider: "youdao-web"
  };
}

export function createLocalRepositories(
  database: SaltoDatabase,
  dependencies: RepositoryDependencies
): LocalRepositories {
  const templateRepository = new DexieQueryTemplateRepository(database, dependencies);
  return {
    vocabulary: new DexieVocabularyRepository(database),
    settings: templateRepository,
    templates: templateRepository,
    queryTemplates: templateRepository,
    llmSettings: new DexieLlmSettingsRepository(database),
    enrichmentJobs: new DexieEnrichmentJobRepository(database),
    learning: new DexieLearningRepository(database),
    saveVocabulary: new DexieSaveVocabularyService(database, dependencies),
    highlightTerms: {
      async list() {
        const items = await database.vocabularyItems.orderBy("sync.updatedAt").toArray();
        const terms = items.map(({ term }) => term);
        const paths: { term: string; path: { xpath: string; startOffset: number; endOffset: number } }[] = [];

        for (const item of items) {
          const contexts = await database.vocabularyContexts
            .where("vocabularyItemId")
            .equals(item.id)
            .toArray();

          for (const context of contexts) {
            if (context.selectionPath) {
              paths.push({
                term: item.term,
                path: {
                  xpath: context.selectionPath.xpath,
                  startOffset: context.selectionPath.startOffset,
                  endOffset: context.selectionPath.endOffset
                }
              });
            }
          }
        }

        return { terms, paths };
      }
    }
  };
}
