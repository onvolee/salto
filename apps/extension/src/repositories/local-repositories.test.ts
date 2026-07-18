import "fake-indexeddb/auto";

import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";

import { createDefaultQueryTemplate, type QueryTemplate } from "@salto/core";
import { SaltoDatabase } from "../db/database";
import { createLocalRepositories } from "./local-repositories";

const databases: SaltoDatabase[] = [];
const clock = () => "2026-07-16T00:00:00.000Z";
let nextId = 0;
const createId = () => `test-id-${++nextId}`;

function createTestRepositories(databaseName: string) {
  const database = new SaltoDatabase(databaseName);
  databases.push(database);
  return { database, repositories: createLocalRepositories(database, { clock, createId }) };
}

function userTemplateInput(name = "Reading notes") {
  return {
    name,
    fields: [{
      id: "translation",
      label: "Translation",
      source: "llm" as const,
      type: "text" as const,
      instruction: "Translate {{selection}}.",
      order: 0,
      enabled: true
    }]
  };
}

function defineLegacySchema(database: Dexie, targetVersion: 3 | 4 | 5 | 6): void {
  database.version(1).stores({
    vocabularyItems: "&id, canonicalKey, language, sync.updatedAt",
    vocabularyFields: "&id, vocabularyItemId, key, status, sync.updatedAt",
    vocabularyContexts: "&id, vocabularyItemId, savedAt, sync.updatedAt",
    learningCards: "&id, vocabularyItemId, cardType, sync.updatedAt",
    learningStates: "&id, learningCardId, dueAt, state, sync.updatedAt",
    reviewLogs: "&id, learningCardId, reviewedAt, sync.updatedAt"
  });
  database.version(2).stores({
    vocabularyItems: "&id, &canonicalKey, language, sync.updatedAt",
    vocabularyFields: "&id, &[vocabularyItemId+key], vocabularyItemId, key, status, sync.updatedAt",
    vocabularyContexts: "&id, vocabularyItemId, pageUrl, savedAt, sync.updatedAt",
    queryTemplates: "&id, updatedAt",
    settings: "&id, activeQueryTemplateId"
  });
  if (targetVersion >= 3) {
    database.version(3).stores({ llmConfigs: "&id, provider", llmSecrets: "&id" });
  }
  if (targetVersion >= 4) {
    database.version(4).stores({
      enrichmentJobs: "&id, [status+nextRunAt], vocabularyItemId, fieldKey"
    });
  }
  if (targetVersion >= 5) {
    database.version(5).stores({
      learningCards: "&id, &[vocabularyItemId+cardType], vocabularyItemId, cardType, sync.updatedAt"
    });
  }
  if (targetVersion >= 6) {
    database.version(6).stores({
      vocabularyContexts: "&id, vocabularyItemId, pageUrl, savedAt, sync.updatedAt, selectionPath"
    });
  }
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (database) => {
    database.close();
    await database.delete();
  }));
  nextId = 0;
});

describe("local repositories", () => {
  it("seeds exact defaults idempotently and repairs missing data", async () => {
    const { database, repositories } = createTestRepositories("defaults-test");

    const first = await repositories.settings.ensureDefaults();
    const second = await repositories.settings.ensureDefaults();

    expect(second).toEqual(first);
    expect(await database.queryTemplates.count()).toBe(1);
    expect(await database.settings.count()).toBe(1);

    await database.queryTemplates.delete("system-default");
    const recovered = await repositories.settings.ensureDefaults();
    expect(recovered.template.id).toBe("system-default");
    expect(recovered.template.createdAt).toBe(clock());
  });

  it("creates, copies, updates, activates, and deletes user templates without losing extra data", async () => {
    const { database, repositories } = createTestRepositories("template-crud-test");
    const created = await repositories.templates.create({
      ...userTemplateInput(),
      extraMetadata: { owner: "reader" }
    } as never);

    expect(created).toEqual(expect.objectContaining({
      id: "test-id-1",
      name: "Reading notes",
      createdAt: clock(),
      updatedAt: clock(),
      extraMetadata: { owner: "reader" }
    }));
    expect((await repositories.templates.copy(created.id)).id).not.toBe(created.id);

    const updated = await repositories.templates.update({
      ...created,
      name: "Updated notes",
      fields: [{
        ...created.fields[0],
        extraFieldData: "retained"
      }]
    } as never);
    expect(updated).toEqual(expect.objectContaining({
      id: created.id,
      name: "Updated notes",
      createdAt: created.createdAt,
      updatedAt: clock(),
      extraMetadata: { owner: "reader" }
    }));
    expect((updated.fields[0] as Record<string, unknown>).extraFieldData).toBe("retained");
    expect(await repositories.templates.get(created.id)).toEqual(updated);

    const activated = await repositories.templates.setDefault(created.id);
    expect(activated.activeQueryTemplateId).toBe(created.id);
    expect((await repositories.settings.getActive()).template.id).toBe(created.id);

    await repositories.templates.delete(created.id);
    const fallback = await repositories.settings.getActive();
    expect(fallback.template.id).toBe("system-default");
    expect(fallback.resolution).toEqual({
      status: "recovered",
      code: "active-template-unavailable",
    });
    expect(await database.queryTemplates.get(created.id)).toBeUndefined();
  });

  it("protects the system template and rejects invalid template or settings writes", async () => {
    const { repositories } = createTestRepositories("template-validation-test");

    await expect(repositories.templates.create({
      name: "Invalid",
      fields: [
        { ...userTemplateInput().fields[0], order: 0 },
        { ...userTemplateInput().fields[0], id: "other", order: 0 }
      ]
    })).rejects.toMatchObject({ code: "template-invalid" });
    await repositories.settings.ensureDefaults();
    expect(await repositories.templates.list()).toHaveLength(1);
    await expect(repositories.templates.delete("system-default"))
      .rejects.toMatchObject({ code: "template-protected" });
    expect(await repositories.templates.list()).toHaveLength(1);
    await expect(repositories.templates.update(createDefaultQueryTemplate(clock())))
      .rejects.toMatchObject({ code: "template-protected" });
    await expect(repositories.settings.save({
      activeQueryTemplateId: "missing",
      targetLanguage: "zh-CN",
      highlightEnabled: true,
      themeMode: "system",
      activeDictionaryProvider: "youdao-web"
    })).rejects.toMatchObject({ code: "template-not-found" });
  });

  it("recovers a corrupted system template and preserves a malformed user record", async () => {
    const { database, repositories } = createTestRepositories("template-recovery-test");
    const user = await repositories.templates.create(userTemplateInput());
    await repositories.templates.setDefault(user.id);
    await database.queryTemplates.put({
      ...createDefaultQueryTemplate(clock()),
      fields: [],
      recoveryMarker: "preserve-invalid-record"
    } as never);
    await database.queryTemplates.put({ ...user, fields: [], recoveryMarker: "preserve-user" } as never);

    const recovered = await repositories.settings.getActive();

    expect(recovered.template.id).toBe("system-default");
    expect(recovered.settings.activeQueryTemplateId).toBe("system-default");
    expect(recovered.resolution).toEqual({
      status: "recovered",
      code: "active-template-unavailable",
    });
    expect((await repositories.settings.getActive()).resolution).toEqual({
      status: "recovered",
      code: "active-template-unavailable",
    });
    expect((await database.queryTemplates.get(user.id) as (QueryTemplate & Record<string, unknown>) | undefined)?.recoveryMarker)
      .toBe("preserve-user");
    expect((await database.queryTemplates.get("system-default"))?.fields).toHaveLength(2);
  });

  it("clears the active-template recovery diagnostic after settings are explicitly saved", async () => {
    const { database, repositories } = createTestRepositories("template-recovery-acknowledgement-test");
    const user = await repositories.templates.create(userTemplateInput());
    await repositories.templates.setDefault(user.id);
    await database.queryTemplates.put({ ...user, fields: [] } as never);

    expect((await repositories.settings.getActive()).resolution.status).toBe("recovered");
    const recoveredSettings = await repositories.settings.get();
    await repositories.settings.save(recoveredSettings);

    expect((await repositories.settings.getActive()).resolution).toEqual({ status: "active" });
  });

  it("persists template, settings, and timestamps across a new repository instance", async () => {
    const databaseName = "template-reopen-test";
    const first = createTestRepositories(databaseName);
    const template = await first.repositories.templates.create(userTemplateInput("Persisted"));
    await first.repositories.settings.save({
      activeQueryTemplateId: template.id,
      targetLanguage: "ja-JP",
      highlightEnabled: false,
      themeMode: "dark",
      activeDictionaryProvider: "youdao-web"
    });
    await first.database.settings.update("extension", {
      extraSetting: "internal-only"
    } as never);
    first.database.close();

    const reopened = createTestRepositories(databaseName);
    expect(await reopened.repositories.templates.get(template.id)).toEqual(template);
    expect(await reopened.repositories.settings.get()).toEqual({
      activeQueryTemplateId: template.id,
      targetLanguage: "ja-JP",
      highlightEnabled: false,
      themeMode: "dark",
      activeDictionaryProvider: "youdao-web",
    });
  });

  it("repairs malformed settings field by field without leaking stored shapes or touching vocabulary", async () => {
    const { database, repositories } = createTestRepositories("settings-recovery-test");
    await database.vocabularyItems.add({
      id: "kept-item",
      canonicalKey: "en:kept",
      term: "Kept",
      language: "en",
      sync: { createdAt: clock(), updatedAt: clock(), recordVersion: 1 }
    });
    await database.settings.put({
      id: "extension",
      activeQueryTemplateId: 42,
      targetLanguage: null,
      highlightEnabled: "yes",
      themeMode: "sepia",
      activeDictionaryProvider: "missing-adapter",
      internalTimestamp: clock()
    } as never);

    await expect(repositories.settings.get()).resolves.toEqual({
      activeQueryTemplateId: "system-default",
      targetLanguage: "zh-CN",
      highlightEnabled: true,
      themeMode: "system",
      activeDictionaryProvider: "youdao-web"
    });
    expect(await database.vocabularyItems.get("kept-item")).toEqual(expect.objectContaining({
      term: "Kept"
    }));
  });

  it("saves once, makes repeated saves idempotent, and stores the ready term field", async () => {
    const { database, repositories } = createTestRepositories("save-test");
    const input = {
      term: "  Running\n shoes ",
      language: "en" as const,
      context: {
        sentence: "I bought Running shoes.",
        paragraphs: "A longer nearby paragraph.",
        pageTitle: "Fixture",
        pageUrl: "HTTPS://Example.COM:443/read?q=1#section"
      }
    };

    const first = await repositories.saveVocabulary.save(input);
    const second = await repositories.saveVocabulary.save(input);

    expect(first.status).toBe("saved");
    expect(second).toEqual({ status: "already-saved", vocabularyItemId: first.vocabularyItemId });
    expect(await database.vocabularyItems.toArray()).toEqual([
      expect.objectContaining({
        id: first.vocabularyItemId,
        canonicalKey: "en:running shoes",
        term: "Running shoes",
        language: "en"
      })
    ]);
    const fields = await database.vocabularyFields.where("vocabularyItemId").equals(first.vocabularyItemId).toArray();
    expect(fields).toHaveLength(7);
    expect(fields).toContainEqual(expect.objectContaining({
      key: "term",
      source: "system",
      status: "ready",
      value: "Running shoes"
    }));
    expect(fields.filter(({ key }) => key !== "term")).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "phonetic", source: "dictionary", status: "pending" }),
      expect.objectContaining({ key: "partOfSpeech", source: "dictionary", status: "pending" }),
      expect.objectContaining({ key: "meaning", source: "dictionary", status: "pending" }),
      expect.objectContaining({ key: "examples", source: "llm", status: "pending" }),
      expect.objectContaining({ key: "synonyms", source: "dictionary", status: "pending" }),
      expect.objectContaining({ key: "wordForms", source: "dictionary", status: "pending" })
    ]));
    expect(await database.vocabularyContexts.toArray()).toEqual([
      expect.objectContaining({
        pageUrl: "https://example.com/read?q=1",
        sentence: "I bought Running shoes."
      })
    ]);
    const jobs = await database.enrichmentJobs.toArray();
    expect(jobs).toHaveLength(6);
    expect(jobs.map((job) => job.fieldKey).sort()).toEqual([
      "examples",
      "meaning",
      "partOfSpeech",
      "phonetic",
      "synonyms",
      "wordForms"
    ]);
    expect(jobs.every((job) => job.status === "queued" && job.attempts === 0)).toBe(true);
  });

  it("adds a second context for a different sentence and reuses the item", async () => {
    const { database, repositories } = createTestRepositories("new-context-test");
    const first = await repositories.saveVocabulary.save({
      term: "Running",
      language: "en" as const,
      context: {
        sentence: "I am running.",
        paragraphs: "",
        pageTitle: "",
        pageUrl: "https://example.com/a"
      }
    });
    const second = await repositories.saveVocabulary.save({
      term: "running",
      language: "en" as const,
      context: {
        sentence: "Running is fun.",
        paragraphs: "",
        pageTitle: "",
        pageUrl: "https://example.com/a"
      }
    });

    expect(second.status).toBe("already-saved");
    expect(second.vocabularyItemId).toBe(first.vocabularyItemId);
    const contexts = await database.vocabularyContexts
      .where("vocabularyItemId")
      .equals(first.vocabularyItemId)
      .toArray();
    expect(contexts).toHaveLength(2);
    expect(contexts.map((context) => context.sentence).sort()).toEqual([
      "I am running.",
      "Running is fun."
    ]);
  });

  it("survives closing and reopening a new service instance", async () => {
    const databaseName = "reopen-test";
    const first = createTestRepositories(databaseName);
    await first.repositories.saveVocabulary.save({
      term: "Unfamiliar",
      language: "en",
      context: { sentence: "An unfamiliar term.", paragraphs: "", pageTitle: "", pageUrl: "" }
    });
    first.database.close();

    const reopened = createTestRepositories(databaseName);
    await reopened.repositories.settings.ensureDefaults();

    expect(await reopened.repositories.highlightTerms.list()).toEqual({
      terms: ["Unfamiliar"],
      paths: []
    });
    expect((await reopened.repositories.settings.getActive()).template.name).toBe("Default");
  });

  it("upgrades the Phase 01 database without losing existing data", async () => {
    const databaseName = "migration-test";
    const legacy = new Dexie(databaseName);
    legacy.version(1).stores({
      vocabularyItems: "&id, canonicalKey, language, sync.updatedAt",
      vocabularyFields: "&id, vocabularyItemId, key, status, sync.updatedAt",
      vocabularyContexts: "&id, vocabularyItemId, savedAt, sync.updatedAt",
      learningCards: "&id, vocabularyItemId, cardType, sync.updatedAt",
      learningStates: "&id, learningCardId, dueAt, state, sync.updatedAt",
      reviewLogs: "&id, learningCardId, reviewedAt, sync.updatedAt"
    });
    await legacy.table("vocabularyItems").add({
      id: "legacy-item",
      canonicalKey: "en:legacy",
      language: "en",
      term: "Legacy",
      sync: { createdAt: clock(), updatedAt: clock(), recordVersion: 1 }
    });
    await legacy.table("learningCards").add({
      id: "legacy-card",
      vocabularyItemId: "legacy-item",
      cardType: "meaning-recall",
      frontFieldKeys: ["term"],
      backFieldKeys: ["meaning"],
      sync: { createdAt: clock(), updatedAt: clock(), recordVersion: 1 }
    });
    legacy.close();

    const upgraded = createTestRepositories(databaseName);
    await upgraded.repositories.settings.ensureDefaults();

    expect(await upgraded.repositories.highlightTerms.list()).toEqual({
      terms: ["Legacy"],
      paths: []
    });
    expect(await upgraded.database.queryTemplates.count()).toBe(1);
    expect(await upgraded.database.settings.count()).toBe(1);
    expect(await upgraded.database.table("learningCards").get("legacy-card")).toEqual(
      expect.objectContaining({ vocabularyItemId: "legacy-item" })
    );
  });

  it("migrates the legacy active template key without dropping template extensions", async () => {
    const databaseName = "template-migration-test";
    const legacy = new Dexie(databaseName);
    legacy.version(2).stores({
      vocabularyItems: "&id, &canonicalKey, language, sync.updatedAt",
      vocabularyFields: "&id, &[vocabularyItemId+key], vocabularyItemId, key, status, sync.updatedAt",
      vocabularyContexts: "&id, vocabularyItemId, pageUrl, savedAt, sync.updatedAt",
      learningCards: "&id, &[vocabularyItemId+cardType], vocabularyItemId, cardType, sync.updatedAt",
      queryTemplates: "&id, updatedAt",
      settings: "&id, activeQueryTemplateId"
    });
    const template: QueryTemplate = {
      ...createDefaultQueryTemplate(clock()),
      id: "legacy-user",
      name: "Legacy user",
      extraMetadata: { migrated: true }
    } as never;
    await legacy.table("queryTemplates").add(template);
    await legacy.table("settings").add({
      id: "extension",
      activeTemplateId: "legacy-user",
      targetLanguage: "zh-CN",
      highlightEnabled: true,
      themeMode: "system"
    });
    legacy.close();

    const upgraded = createTestRepositories(databaseName);
    const active = await upgraded.repositories.settings.getActive();

    expect(active.template.id).toBe("legacy-user");
    expect(active.settings.activeQueryTemplateId).toBe("legacy-user");
    expect(((await upgraded.repositories.templates.get("legacy-user")) as (QueryTemplate & Record<string, unknown>) | undefined)?.extraMetadata)
      .toEqual({ migrated: true });
  });

  it.each([3, 4, 5, 6] as const)(
    "upgrades schema v%i without losing persisted template or vocabulary data",
    async (version) => {
      const databaseName = `migration-v${version}-test`;
      const legacy = new Dexie(databaseName);
      defineLegacySchema(legacy, version);
      const legacyTemplate = {
        ...createDefaultQueryTemplate(clock()),
        id: `legacy-template-v${version}`,
        name: `Legacy template v${version}`,
        migrationExtension: { version },
        fields: [{
          ...createDefaultQueryTemplate(clock()).fields[0],
          migrationFieldExtension: `v${version}`
        }]
      };
      await legacy.table("vocabularyItems").add({
        id: `legacy-item-v${version}`,
        canonicalKey: `en:legacy-${version}`,
        language: "en",
        term: `Legacy ${version}`,
        sync: { createdAt: clock(), updatedAt: clock(), recordVersion: 1 }
      });
      await legacy.table("vocabularyFields").add({
        id: `legacy-item-v${version}:term`,
        vocabularyItemId: `legacy-item-v${version}`,
        key: "term",
        source: "system",
        status: "ready",
        value: `Legacy ${version}`,
        sync: { createdAt: clock(), updatedAt: clock(), recordVersion: 1 }
      });
      await legacy.table("vocabularyContexts").add({
        id: `legacy-context-v${version}`,
        vocabularyItemId: `legacy-item-v${version}`,
        sentence: `Legacy sentence ${version}.`,
        paragraphs: "",
        pageTitle: "Legacy",
        pageUrl: `https://example.com/v${version}`,
        selectionPath: { xpath: "/html/body/p[1]", startOffset: 0, endOffset: 6 },
        savedAt: clock(),
        sync: { createdAt: clock(), updatedAt: clock(), recordVersion: 1 }
      });
      await legacy.table("queryTemplates").add(legacyTemplate);
      await legacy.table("settings").add({
        id: "extension",
        activeQueryTemplateId: legacyTemplate.id,
        targetLanguage: "zh-CN",
        highlightEnabled: true,
        themeMode: "system"
      });
      if (version >= 4) {
        await legacy.table("enrichmentJobs").add({
          id: `legacy-job-v${version}`,
          vocabularyItemId: `legacy-item-v${version}`,
          fieldKey: "meaning",
          source: "dictionary",
          status: "queued",
          attempts: 0,
          nextRunAt: clock()
        });
      }
      legacy.close();

      const upgraded = createTestRepositories(databaseName);
      const active = await upgraded.repositories.settings.getActive();
      const migratedTemplate = await upgraded.repositories.templates.get(legacyTemplate.id);

      expect(active.settings.activeQueryTemplateId).toBe(legacyTemplate.id);
      expect(active.template.id).toBe(legacyTemplate.id);
      expect(migratedTemplate).toEqual(expect.objectContaining({
        migrationExtension: { version }
      }));
      expect((migratedTemplate?.fields[0] as Record<string, unknown>).migrationFieldExtension)
        .toBe(`v${version}`);
      expect(await upgraded.database.vocabularyItems.get(`legacy-item-v${version}`))
        .toEqual(expect.objectContaining({ term: `Legacy ${version}` }));
      expect(await upgraded.database.vocabularyFields.get(`legacy-item-v${version}:term`))
        .toEqual(expect.objectContaining({ value: `Legacy ${version}` }));
      expect(await upgraded.database.vocabularyContexts.get(`legacy-context-v${version}`))
        .toEqual(expect.objectContaining({ pageUrl: `https://example.com/v${version}` }));
      if (version >= 4) {
        expect(await upgraded.database.enrichmentJobs.get(`legacy-job-v${version}`))
          .toEqual(expect.objectContaining({ status: "queued" }));
      }
    }
  );

  it("stores public LLM configuration separately from its write-only secret", async () => {
    const { database, repositories } = createTestRepositories("llm-settings-test");
    const config = {
      provider: "openai-compatible" as const,
      baseUrl: "https://api.example.com/v1",
      model: "model-a",
      temperature: 0.3,
    };

    await repositories.llmSettings.save(config, { apiKey: "secret-a" });

    expect(await repositories.llmSettings.getPublicState()).toEqual({
      config,
      hasApiKey: true,
    });
    expect(await database.llmConfigs.toArray()).toEqual([
      { id: "active", ...config },
    ]);
    expect(await database.llmSecrets.toArray()).toEqual([
      { id: "active", apiKey: "secret-a" },
    ]);
  });

  it("keeps the existing LLM secret when public configuration changes", async () => {
    const databaseName = "llm-settings-reopen-test";
    const first = createTestRepositories(databaseName);
    await first.repositories.llmSettings.save({
      provider: "openai-compatible",
      baseUrl: "https://api.example.com/v1",
      model: "model-a",
    }, { apiKey: "secret-a" });
    await first.repositories.llmSettings.save({
      provider: "openai-compatible",
      baseUrl: "https://api.example.com/v1",
      model: "model-b",
    });
    first.database.close();

    const reopened = createTestRepositories(databaseName);
    expect(await reopened.repositories.llmSettings.getCredentials()).toEqual({
      config: {
        provider: "openai-compatible",
        baseUrl: "https://api.example.com/v1",
        model: "model-b",
      },
      secret: { apiKey: "secret-a" },
    });
  });

  it("quarantines a malformed public LLM config without deleting the write-only secret", async () => {
    const { database, repositories } = createTestRepositories("llm-settings-recovery-test");
    await repositories.llmSettings.save({
      provider: "openai-compatible",
      baseUrl: "https://api.example.com/v1",
      model: "model-a",
    }, { apiKey: "secret-a" });
    await database.llmConfigs.put({
      id: "active",
      provider: "unknown-provider",
      baseUrl: "not a URL",
      model: "",
      temperature: 99,
    } as never);

    await expect(repositories.llmSettings.getPublicState()).resolves.toEqual({
      hasApiKey: true,
    });
    await expect(repositories.llmSettings.getCredentials()).resolves.toBeNull();
    expect(await database.llmSecrets.get("active")).toEqual({
      id: "active",
      apiKey: "secret-a",
    });

    await repositories.llmSettings.save({
      provider: "openai-compatible",
      baseUrl: "https://replacement.example/v1",
      model: "model-b",
    });
    await expect(repositories.llmSettings.getCredentials()).resolves.toEqual({
      config: {
        provider: "openai-compatible",
        baseUrl: "https://replacement.example/v1",
        model: "model-b",
      },
      secret: { apiKey: "secret-a" },
    });
  });

  it.each(["   ", 42])(
    "treats malformed LLM secret %j as not configured without deleting it",
    async (apiKey) => {
      const { database, repositories } = createTestRepositories(`llm-secret-recovery-${String(apiKey)}`);
      await repositories.llmSettings.save({
        provider: "openai-compatible",
        baseUrl: "https://api.example.com/v1",
        model: "model-a",
      }, { apiKey: "secret-a" });
      await database.llmSecrets.put({ id: "active", apiKey } as never);

      await expect(repositories.llmSettings.getPublicState()).resolves.toEqual({
        config: {
          provider: "openai-compatible",
          baseUrl: "https://api.example.com/v1",
          model: "model-a",
        },
        hasApiKey: false,
      });
      await expect(repositories.llmSettings.getCredentials()).resolves.toBeNull();
      expect(await database.llmSecrets.get("active")).toEqual({ id: "active", apiKey });
      await expect(repositories.llmSettings.save({
        provider: "openai-compatible",
        baseUrl: "https://replacement.example/v1",
        model: "model-b",
      })).rejects.toThrow("API key is required");
    },
  );
});
