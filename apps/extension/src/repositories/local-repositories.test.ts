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

    const first = await repositories.vocabulary.save(input);
    const second = await repositories.vocabulary.save(input);

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
  });

  it("survives closing and reopening a new service instance", async () => {
    const databaseName = "reopen-test";
    const first = createTestRepositories(databaseName);
    await first.repositories.vocabulary.save({
      term: "Unfamiliar",
      language: "en",
      context: { sentence: "An unfamiliar term.", paragraphs: "", pageTitle: "", pageUrl: "" }
    });
    first.database.close();

    const reopened = createTestRepositories(databaseName);
    await reopened.repositories.settings.ensureDefaults();

    expect(await reopened.repositories.highlightTerms.list()).toEqual(["Unfamiliar"]);
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

    expect(await upgraded.repositories.highlightTerms.list()).toEqual(["Legacy"]);
    expect(await upgraded.database.queryTemplates.count()).toBe(1);
    expect(await upgraded.database.settings.count()).toBe(1);
    expect(await upgraded.database.table("learningCards").get("legacy-card")).toEqual(
      expect.objectContaining({ vocabularyItemId: "legacy-item" })
    );
  });
});
