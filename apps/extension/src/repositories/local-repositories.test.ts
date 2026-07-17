import "fake-indexeddb/auto";

import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";

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
});
