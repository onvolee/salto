import {
  DEFAULT_EXTENSION_SETTINGS,
  canonicalizeEnglishTerm,
  createDefaultQueryTemplate,
  isValidExtensionSettings,
  isValidQueryTemplate,
  isValidQueryTemplateInput,
  isValidTemplateFieldDefinition,
  isValidTemplateFieldDefinitionInput,
  normalizeLlmPublicConfig,
  normalizeVocabularyText,
  type ActiveQueryTemplateResolution,
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
  type TemplateFieldDefinition,
  type TemplateFieldDefinitionInput,
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
  ensureDefaults(): Promise<{
    readonly settings: ExtensionSettings;
    readonly template: QueryTemplate;
    readonly resolution: ActiveQueryTemplateResolution;
  }>;
  getActive(): Promise<{
    readonly settings: ExtensionSettings;
    readonly template: QueryTemplate;
    readonly resolution: ActiveQueryTemplateResolution;
  }>;
  get(): Promise<ExtensionSettings>;
  getMigrationState(): Promise<{ readonly legacySettingsCompleted: boolean }>;
  save(settings: ExtensionSettings): Promise<ExtensionSettings>;
  saveLegacySettingsMigration(settings: ExtensionSettings): Promise<ExtensionSettings>;
  update(settings: ExtensionSettings): Promise<ExtensionSettings>;
  hasDictionaryConsent(permissionOrigin: string): Promise<boolean>;
  recordDictionaryConsent(permissionOrigin: string): Promise<void>;
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

export type TemplateFieldDefinitionRepositoryErrorCode =
  | "field-definition-not-found"
  | "field-definition-invalid";

export class TemplateFieldDefinitionRepositoryError extends Error {
  constructor(
    readonly code: TemplateFieldDefinitionRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TemplateFieldDefinitionRepositoryError";
  }
}

export interface TemplateFieldDefinitionRepository {
  list(): Promise<readonly TemplateFieldDefinition[]>;
  get(id: string): Promise<TemplateFieldDefinition | undefined>;
  create(input: TemplateFieldDefinitionInput): Promise<TemplateFieldDefinition>;
  update(id: string, input: TemplateFieldDefinitionInput): Promise<TemplateFieldDefinition>;
  delete(id: string): Promise<void>;
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
  getCredentialState(): Promise<LlmCredentialState>;
  getCredentials(): Promise<{
    readonly config: LlmPublicConfig;
    readonly secret: LlmSecret;
  } | null>;
  save(config: LlmPublicConfig, secret?: LlmSecret, consentedOrigin?: string): Promise<void>;
  recordConsent(permissionOrigin: string): Promise<void>;
}

export type LlmCredentialState =
  | { readonly status: "not-configured" }
  | { readonly status: "consent-required"; readonly config: LlmPublicConfig }
  | {
      readonly status: "ready";
      readonly config: LlmPublicConfig;
      readonly secret: LlmSecret;
      readonly permissionOrigin: string;
    };

export type LocalRepositories = {
  readonly vocabulary: VocabularyRepository;
  readonly settings: SettingsRepository;
  readonly templates: QueryTemplateRepository;
  readonly queryTemplates: QueryTemplateRepository;
  readonly fieldDefinitions: TemplateFieldDefinitionRepository;
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

  async exists(term: string, language: string): Promise<boolean> {
    const canonicalKey = `${language}:${term.toLocaleLowerCase("en-US")}`;
    const count = await this.database.vocabularyItems.where("canonicalKey").equals(canonicalKey).count();
    return count > 0;
  }

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

  async ensureDefaults(): Promise<{
    readonly settings: ExtensionSettings;
    readonly template: QueryTemplate;
    readonly resolution: ActiveQueryTemplateResolution;
  }> {
    return this.database.transaction(
      "rw",
      [this.database.settings, this.database.queryTemplates, this.database.templateFieldDefinitions],
      async () => this.ensureDefaultsInTransaction()
    );
  }

  async getActive(): Promise<{
    readonly settings: ExtensionSettings;
    readonly template: QueryTemplate;
    readonly resolution: ActiveQueryTemplateResolution;
  }> {
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
      [this.database.settings, this.database.queryTemplates, this.database.templateFieldDefinitions],
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
          highlightSameWords: settings.highlightSameWords,
          themeMode: settings.themeMode,
          activeDictionaryProvider: "youdao-web",
          panelWidth: settings.panelWidth,
          panelHeight: settings.panelHeight,
          ...(current?.dictionaryConsentedOrigin
            ? { dictionaryConsentedOrigin: current.dictionaryConsentedOrigin }
            : {}),
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

  async hasDictionaryConsent(permissionOrigin: string): Promise<boolean> {
    await this.ensureDefaults();
    return (await this.database.settings.get("extension"))?.dictionaryConsentedOrigin === permissionOrigin;
  }

  async recordDictionaryConsent(permissionOrigin: string): Promise<void> {
    if (!isNonEmptyString(permissionOrigin)) {
      throw new QueryTemplateRepositoryError("settings-invalid", "Invalid dictionary consent origin");
    }
    await this.ensureDefaults();
    await this.database.settings.update("extension", { dictionaryConsentedOrigin: permissionOrigin });
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
      [this.database.settings, this.database.queryTemplates, this.database.templateFieldDefinitions],
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
      [this.database.settings, this.database.queryTemplates, this.database.templateFieldDefinitions],
      async () => {
        await this.ensureDefaultsInTransaction();
        const source = await this.validTemplate(id);
        if (!source) {
          throw new QueryTemplateRepositoryError("template-not-found", "Query template was not found");
        }
        const timestamp = this.dependencies.clock();
        const copyId = await this.nextTemplateId();
        const resultIds = new Set<string>();
        const fields = source.fields.map((field) => {
          let resultId = this.dependencies.createId();
          while (!isNonEmptyString(resultId) || resultIds.has(resultId)) {
            resultId = this.dependencies.createId();
          }
          resultIds.add(resultId);
          return { ...field, id: resultId };
        });
        const copy = {
          ...source,
          id: copyId,
          name: `${source.name} copy`,
          fields,
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
      [this.database.settings, this.database.queryTemplates, this.database.templateFieldDefinitions],
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
      [this.database.settings, this.database.queryTemplates, this.database.templateFieldDefinitions],
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
            activeQueryTemplateId: "system-default",
            activeQueryTemplateRecovery: "active-template-unavailable",
          });
        }
      }
    );
  }

  async setDefault(id: string): Promise<{ readonly template: QueryTemplate; readonly activeQueryTemplateId: string }> {
    return this.database.transaction(
      "rw",
      [this.database.settings, this.database.queryTemplates, this.database.templateFieldDefinitions],
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
        const { activeQueryTemplateRecovery: _recovery, ...acknowledgedSettings } = settings;
        await this.database.settings.put({ ...acknowledgedSettings, activeQueryTemplateId: id });
        return { template, activeQueryTemplateId: id };
      }
    );
  }

  private async ensureDefaultsInTransaction() {
    let systemTemplate = await this.database.queryTemplates.get("system-default");
    const rawSettings = await this.database.settings.get("extension");
    const systemTemplateWasUnavailable = rawSettings !== undefined && !isValidQueryTemplate(systemTemplate);
    if (!isValidQueryTemplate(systemTemplate)) {
      systemTemplate = createDefaultQueryTemplate(this.dependencies.clock());
      await this.database.queryTemplates.put(systemTemplate);
    }

    const settings = normalizeStoredSettings(rawSettings);
    const activeTemplate = await this.validTemplate(settings.activeQueryTemplateId);
    const activeSettingWasMalformed = rawSettings !== undefined
      && !isNonEmptyString(rawSettings.activeQueryTemplateId);
    const recovered = rawSettings?.activeQueryTemplateRecovery === "active-template-unavailable"
      || activeSettingWasMalformed
      || !activeTemplate
      || (settings.activeQueryTemplateId === "system-default" && systemTemplateWasUnavailable);
    const activeQueryTemplateId = activeTemplate ? settings.activeQueryTemplateId : systemTemplate.id;
    const repairedSettings: StoredExtensionSettings = {
      ...settings,
      id: "extension" as const,
      activeQueryTemplateId,
      ...(recovered
        ? { activeQueryTemplateRecovery: "active-template-unavailable" as const }
        : {}),
    };
    await this.database.settings.put(repairedSettings);
    return {
      settings: stripSettingsId(repairedSettings),
      template: activeTemplate ?? systemTemplate,
      resolution: recovered
        ? { status: "recovered" as const, code: "active-template-unavailable" as const }
        : { status: "active" as const },
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

class DexieTemplateFieldDefinitionRepository implements TemplateFieldDefinitionRepository {
  constructor(
    private readonly database: SaltoDatabase,
    private readonly dependencies: RepositoryDependencies,
  ) {}

  async list(): Promise<readonly TemplateFieldDefinition[]> {
    const definitions = await this.database.templateFieldDefinitions.toArray();
    return definitions.filter(isValidTemplateFieldDefinition);
  }

  async get(id: string): Promise<TemplateFieldDefinition | undefined> {
    if (!isNonEmptyString(id)) return undefined;
    const definition = await this.database.templateFieldDefinitions.get(id);
    return isValidTemplateFieldDefinition(definition) ? definition : undefined;
  }

  async create(input: TemplateFieldDefinitionInput): Promise<TemplateFieldDefinition> {
    if (!isValidTemplateFieldDefinitionInput(input)) {
      throw new TemplateFieldDefinitionRepositoryError(
        "field-definition-invalid",
        "Invalid template field definition",
      );
    }
    return this.database.transaction(
      "rw",
      this.database.templateFieldDefinitions,
      async () => {
        const timestamp = this.dependencies.clock();
        const definition = {
          ...normalizeTemplateFieldDefinitionInput(input),
          id: await this.nextId(),
          createdAt: timestamp,
          updatedAt: timestamp,
        } as TemplateFieldDefinition;
        await this.database.templateFieldDefinitions.add(definition);
        return definition;
      },
    );
  }

  async update(
    id: string,
    input: TemplateFieldDefinitionInput,
  ): Promise<TemplateFieldDefinition> {
    if (!isValidTemplateFieldDefinitionInput(input)) {
      throw new TemplateFieldDefinitionRepositoryError(
        "field-definition-invalid",
        "Invalid template field definition",
      );
    }
    return this.database.transaction(
      "rw",
      this.database.templateFieldDefinitions,
      async () => {
        const existing = await this.database.templateFieldDefinitions.get(id);
        if (!isValidTemplateFieldDefinition(existing)) {
          throw new TemplateFieldDefinitionRepositoryError(
            "field-definition-not-found",
            "Template field definition was not found",
          );
        }
        const updated = {
          ...normalizeTemplateFieldDefinitionInput(input),
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: this.dependencies.clock(),
        } as TemplateFieldDefinition;
        await this.database.templateFieldDefinitions.put(updated);
        return updated;
      },
    );
  }

  async delete(id: string): Promise<void> {
    await this.database.transaction(
      "rw",
      this.database.templateFieldDefinitions,
      async () => {
        const existing = await this.database.templateFieldDefinitions.get(id);
        if (!isValidTemplateFieldDefinition(existing)) {
          throw new TemplateFieldDefinitionRepositoryError(
            "field-definition-not-found",
            "Template field definition was not found",
          );
        }
        await this.database.templateFieldDefinitions.delete(id);
      },
    );
  }

  private async nextId(): Promise<string> {
    let id = this.dependencies.createId();
    while (!isNonEmptyString(id) || await this.database.templateFieldDefinitions.get(id)) {
      id = this.dependencies.createId();
    }
    return id;
  }
}

function normalizeTemplateFieldDefinitionInput(
  input: TemplateFieldDefinitionInput,
): TemplateFieldDefinitionInput {
  return {
    ...input,
    label: input.label.trim(),
    ...(input.description?.trim()
      ? { description: input.description.trim() }
      : { description: undefined }),
    ...(input.source === "llm" ? { instruction: input.instruction.trim() } : {}),
  } as TemplateFieldDefinitionInput;
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
    const state = await this.getCredentialState();
    return state.status === "ready"
      ? { config: state.config, secret: state.secret }
      : null;
  }

  async getCredentialState(): Promise<LlmCredentialState> {
    const [storedConfig, storedSecret] = await Promise.all([
      this.database.llmConfigs.get("active"),
      this.database.llmSecrets.get("active")
    ]);
    const config = normalizeStoredLlmConfig(storedConfig);
    if (!config || !isValidApiKey(storedSecret?.apiKey)) {
      return { status: "not-configured" };
    }
    const permissionOrigin = normalizeLlmPublicConfig(config).permissionOrigin;
    if (storedConfig?.consentedOrigin !== permissionOrigin) {
      return { status: "consent-required", config };
    }
    const { id: _secretId, ...secret } = storedSecret;
    return { status: "ready", config, secret, permissionOrigin };
  }

  async save(config: LlmPublicConfig, secret?: LlmSecret, consentedOrigin?: string): Promise<void> {
    const normalized = normalizeLlmPublicConfig(config);
    const normalizedConfig = normalized.config;
    if (consentedOrigin !== undefined && consentedOrigin !== normalized.permissionOrigin) {
      throw new Error("LLM consent origin does not match the configured origin");
    }
    const nextApiKey = typeof secret?.apiKey === "string" ? secret.apiKey.trim() : "";
    await this.database.transaction(
      "rw",
      [this.database.llmConfigs, this.database.llmSecrets],
      async () => {
        const existingSecret = await this.database.llmSecrets.get("active");
        const existingConfig = await this.database.llmConfigs.get("active");
        if (!nextApiKey && !isValidApiKey(existingSecret?.apiKey)) {
          throw new Error("An API key is required for the first LLM configuration");
        }
        const existingOrigin = existingConfig
          ? normalizeStoredLlmConfig(existingConfig)
          : undefined;
        const preservedConsent = existingOrigin
          && normalizeLlmPublicConfig(existingOrigin).permissionOrigin === normalized.permissionOrigin
          ? existingConfig?.consentedOrigin
          : undefined;
        const nextConsent = consentedOrigin ?? preservedConsent;
        await this.database.llmConfigs.put({
          id: "active",
          ...normalizedConfig,
          ...(nextConsent ? { consentedOrigin: nextConsent } : {}),
        });
        if (nextApiKey) {
          await this.database.llmSecrets.put({ id: "active", apiKey: nextApiKey });
        }
      }
    );
  }

  async recordConsent(permissionOrigin: string): Promise<void> {
    const [storedConfig, storedSecret] = await Promise.all([
      this.database.llmConfigs.get("active"),
      this.database.llmSecrets.get("active"),
    ]);
    const config = normalizeStoredLlmConfig(storedConfig);
    if (
      !config
      || !isValidApiKey(storedSecret?.apiKey)
      || normalizeLlmPublicConfig(config).permissionOrigin !== permissionOrigin
    ) {
      throw new Error("LLM configuration is not ready for origin consent");
    }
    await this.database.llmConfigs.update("active", { consentedOrigin: permissionOrigin });
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
  const { id: _id, consentedOrigin: _consentedOrigin, ...config } = stored;
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
    highlightSameWords: typeof raw.highlightSameWords === "boolean"
      ? raw.highlightSameWords
      : DEFAULT_EXTENSION_SETTINGS.highlightSameWords,
    themeMode: raw.themeMode === "system" || raw.themeMode === "light" || raw.themeMode === "dark"
      ? raw.themeMode
      : DEFAULT_EXTENSION_SETTINGS.themeMode,
    activeDictionaryProvider: "youdao-web",
    panelWidth: typeof raw.panelWidth === "number"
      ? raw.panelWidth
      : DEFAULT_EXTENSION_SETTINGS.panelWidth,
    panelHeight: typeof raw.panelHeight === "number"
      ? raw.panelHeight
      : DEFAULT_EXTENSION_SETTINGS.panelHeight,
    ...(isNonEmptyString(raw.dictionaryConsentedOrigin)
      ? { dictionaryConsentedOrigin: raw.dictionaryConsentedOrigin }
      : {}),
    ...(raw.legacySettingsMigrationCompleted === true
      ? { legacySettingsMigrationCompleted: true }
      : {}),
    ...(raw.activeQueryTemplateRecovery === "active-template-unavailable"
      ? { activeQueryTemplateRecovery: "active-template-unavailable" as const }
      : {}),
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
    highlightSameWords: settings.highlightSameWords,
    themeMode: settings.themeMode,
    activeDictionaryProvider: "youdao-web",
    panelWidth: settings.panelWidth,
    panelHeight: settings.panelHeight,
  };
}

export function createLocalRepositories(
  database: SaltoDatabase,
  dependencies: RepositoryDependencies
): LocalRepositories {
  const templateRepository = new DexieQueryTemplateRepository(database, dependencies);
  const fieldDefinitionRepository = new DexieTemplateFieldDefinitionRepository(database, dependencies);
  return {
    vocabulary: new DexieVocabularyRepository(database),
    settings: templateRepository,
    templates: templateRepository,
    queryTemplates: templateRepository,
    fieldDefinitions: fieldDefinitionRepository,
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
