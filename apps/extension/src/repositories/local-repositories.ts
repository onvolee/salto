import {
  DEFAULT_EXTENSION_SETTINGS,
  canonicalizeEnglishTerm,
  createDefaultQueryTemplate,
  normalizeVocabularyText,
  type ExtensionSettings,
  type LlmConfigState,
  type LlmPublicConfig,
  type LlmSecret,
  type QueryTemplate,
  type SaveVocabularyInput,
  type SaveVocabularyResult,
  type SyncMetadata,
  type VocabularyContext,
  type VocabularyFieldFor,
  type VocabularyFieldKey,
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
} as const satisfies Record<Exclude<VocabularyFieldKey, "term">, "dictionary" | "llm">;

class DexieVocabularyRepository implements VocabularyRepository {
  constructor(
    private readonly database: SaltoDatabase,
    private readonly dependencies: RepositoryDependencies
  ) {}

  async save(input: SaveVocabularyInput): Promise<SaveVocabularyResult> {
    const normalized = canonicalizeEnglishTerm(input.term);

    return this.database.transaction(
      "rw",
      [this.database.vocabularyItems, this.database.vocabularyFields, this.database.vocabularyContexts],
      async () => {
        const timestamp = this.dependencies.clock();
        const existing = await this.findItemByCanonicalKey(normalized.canonicalKey);
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

        const termField: VocabularyFieldFor<"term"> = {
          id: `${item.id}:term`,
          vocabularyItemId: item.id,
          key: "term",
          source: "system",
          status: "ready",
          value: item.term,
          sync: createSyncMetadata(timestamp)
        };
        await addIfAbsent(() => this.database.vocabularyFields.add(termField));

        for (const [key, source] of Object.entries(REMOTE_FIELD_SOURCES) as Array<
          [Exclude<VocabularyFieldKey, "term">, "dictionary" | "llm"]
        >) {
          const field = {
            id: `${item.id}:${key}`,
            vocabularyItemId: item.id,
            key,
            source,
            status: "pending" as const,
            sync: createSyncMetadata(timestamp)
          };
          await addIfAbsent(() => this.database.vocabularyFields.add(field));
        }

        const sentence = normalizeVocabularyText(input.context.sentence);
        const pageUrl = normalizePageUrl(input.context.pageUrl);
        const context: VocabularyContext = {
          id: contextId(item.id, pageUrl, sentence),
          vocabularyItemId: item.id,
          sentence,
          paragraphs: normalizeVocabularyText(input.context.paragraphs),
          pageTitle: normalizeVocabularyText(input.context.pageTitle),
          pageUrl,
          savedAt: timestamp,
          sync: createSyncMetadata(timestamp)
        };
        await addIfAbsent(() => this.database.vocabularyContexts.add(context));

        return {
          status: existing ? "already-saved" : "saved",
          vocabularyItemId: item.id
        };
      }
    );
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
      this.database.llmSecrets.get("active"),
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
      this.database.llmSecrets.get("active"),
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
      },
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
    vocabulary: new DexieVocabularyRepository(database, dependencies),
    settings: new DexieSettingsRepository(database, dependencies),
    llmSettings: new DexieLlmSettingsRepository(database),
    highlightTerms: {
      async list() {
        return (await database.vocabularyItems.orderBy("sync.updatedAt").toArray()).map(({ term }) => term);
      }
    }
  };
}
