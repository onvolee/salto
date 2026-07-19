import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDictionaryClient,
  createFakeDictionaryAdapter,
  DictionaryLookupError,
  type DictionaryAdapter,
  type DictionaryLookupResult,
  type VocabularyField,
} from "@salto/core";

import { SaltoDatabase } from "../db/database";
import { createLocalRepositories } from "../repositories";

import { createDeterministicDictionaryFake } from "./deterministic-dictionary-fake";
import { createDictionaryEnrichmentSource } from "./dictionary-enrichment-source";
import { createEnrichmentQueue } from "./enrichment-queue";
import type { EnrichmentSource } from "./types";

const databases: SaltoDatabase[] = [];
const clock = () => "2026-07-16T00:00:00.000Z";
let nextId = 0;
const createId = () => `test-id-${++nextId}`;

function createTestDatabase(name: string) {
  const database = new SaltoDatabase(name);
  databases.push(database);
  return database;
}

function createRepositories(database: SaltoDatabase) {
  return createLocalRepositories(database, { clock, createId });
}

function createFakeLlmSource(): import("./types").EnrichmentSource {
  return {
    async executeBatch(request) {
      return request.jobs
        .filter((job) => job.source === "llm")
        .map((job) => ({
          jobId: job.id,
          fieldKey: job.fieldKey,
          status: "ready" as const,
          value: ["Example sentence one.", "Example sentence two."]
        }));
    }
  };
}

function createQueue(
  database: SaltoDatabase,
  repositories: ReturnType<typeof createRepositories>,
  options: { failFields?: readonly ("phonetic" | "partOfSpeech" | "meaning" | "synonyms" | "wordForms")[] } = {}
) {
  const dictionarySource = options.failFields
    ? createDeterministicDictionaryFake({ failFields: options.failFields })
    : createDictionaryEnrichmentSource({
      settings: repositories.settings,
      dictionaryClient: createDictionaryClient(createFakeDictionaryAdapter({
        providerId: "youdao-web",
        supportedLanguages: ["en"],
        fixtures: [{
          request: { term: "unfamiliar", language: "en" },
          fields: {
            phonetic: "/unfamiliar/",
            partOfSpeech: "noun",
            meaning: "(dictionary) unfamiliar",
            synonyms: ["unfamiliar-synonym-1", "unfamiliar-synonym-2"],
            wordForms: ["unfamiliars", "unfamiliaring"],
          },
        }],
      })),
    });
  return createQueueWithSources(database, repositories, [dictionarySource, createFakeLlmSource()]);
}

function createQueueWithSources(
  database: SaltoDatabase,
  repositories: ReturnType<typeof createRepositories>,
  sources: readonly EnrichmentSource[],
) {
  return createEnrichmentQueue({
    database,
    repositories: {
      enrichmentJobs: repositories.enrichmentJobs,
      learning: repositories.learning,
      vocabulary: repositories.vocabulary
    },
    sources,
    clock,
    createId,
    maxAttempts: 3,
    initialBackoffMs: 0,
    maxBackoffMs: 0,
    claimTimeoutMs: 60_000
  });
}

async function saveFixture(
  repositories: ReturnType<typeof createRepositories>,
  term = "unfamiliar"
) {
  return repositories.saveVocabulary.save({
    term,
    language: "en",
    context: {
      sentence: `An ${term} term appears here.`,
      paragraphs: "A nearby paragraph.",
      pageTitle: "Fixture",
      pageUrl: "https://example.com/read"
    }
  });
}

async function readField(
  repositories: ReturnType<typeof createRepositories>,
  vocabularyItemId: string,
  fieldKey: VocabularyField["key"],
) {
  return (await repositories.vocabulary.listFields(vocabularyItemId))
    .find((field) => field.key === fieldKey);
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (database) => {
    database.close();
    await database.delete();
  }));
  nextId = 0;
});

describe("enrichment queue", () => {
  it("processes queued dictionary jobs and creates a meaning-recall card", async () => {
    const database = createTestDatabase("enrich-success");
    const repositories = createRepositories(database);
    const queue = createQueue(database, repositories);
    const saved = await saveFixture(repositories);

    await queue.wake();

    const jobs = await database.enrichmentJobs.toArray();
    expect(jobs).toHaveLength(0);

    const fields = await database.vocabularyFields
      .where("vocabularyItemId")
      .equals(saved.vocabularyItemId)
      .toArray();
    const byKey = new Map(fields.map((field) => [field.key, field]));
    expect(byKey.get("term")).toEqual(expect.objectContaining({ status: "ready", value: "unfamiliar" }));
    expect(byKey.get("meaning")).toEqual(expect.objectContaining({ status: "ready", value: "(dictionary) unfamiliar" }));
    expect(byKey.get("phonetic")).toEqual(expect.objectContaining({ status: "ready", value: "/unfamiliar/" }));
    expect(byKey.get("partOfSpeech")).toEqual(expect.objectContaining({ status: "ready", value: "noun" }));
    expect(byKey.get("synonyms")).toEqual(expect.objectContaining({ status: "ready", value: ["unfamiliar-synonym-1", "unfamiliar-synonym-2"] }));
    expect(byKey.get("wordForms")).toEqual(expect.objectContaining({ status: "ready", value: ["unfamiliars", "unfamiliaring"] }));

    const cards = await database.learningCards.toArray();
    expect(cards).toEqual([
      expect.objectContaining({
        id: `${saved.vocabularyItemId}:meaning-recall`,
        vocabularyItemId: saved.vocabularyItemId,
        cardType: "meaning-recall",
        frontFieldKeys: ["term"],
        backFieldKeys: ["meaning"]
      })
    ]);
  });

  it("persists partial fake-adapter results and retries only unfinished fields", async () => {
    const database = createTestDatabase("dictionary-client-partial");
    const repositories = createRepositories(database);
    const saved = await saveFixture(repositories);
    const firstAdapter = createFakeDictionaryAdapter({
      providerId: "youdao-web",
      supportedLanguages: ["en"],
      fixtures: [{
        request: { term: "unfamiliar", language: "en" },
        fields: {
          phonetic: "/original/",
          meaning: "A term that is not familiar",
        },
      }],
    });
    const firstLookup = vi.fn<DictionaryAdapter["lookup"]>(firstAdapter.lookup.bind(firstAdapter));
    const firstSource = createDictionaryEnrichmentSource({
      settings: repositories.settings,
      dictionaryClient: createDictionaryClient({ ...firstAdapter, lookup: firstLookup }),
    });
    const firstQueue = createQueueWithSources(
      database,
      repositories,
      [firstSource, createFakeLlmSource()],
    );

    await firstQueue.wake();

    expect(firstLookup).toHaveBeenCalledOnce();
    expect(await readField(repositories, saved.vocabularyItemId, "phonetic"))
      .toEqual(expect.objectContaining({ status: "ready", value: "/original/" }));
    expect(await readField(repositories, saved.vocabularyItemId, "synonyms"))
      .toEqual(expect.objectContaining({ status: "pending" }));
    expect((await repositories.enrichmentJobs.listByVocabularyItem(saved.vocabularyItemId))
      .map((pendingJob) => pendingJob.fieldKey).toSorted())
      .toEqual(["partOfSpeech", "synonyms", "wordForms"]);

    const retryAdapter = createFakeDictionaryAdapter({
      providerId: "youdao-web",
      supportedLanguages: ["en"],
      fixtures: [{
        request: { term: "unfamiliar", language: "en" },
        fields: {
          phonetic: "/replacement/",
          partOfSpeech: "adjective",
          meaning: "replacement meaning",
          synonyms: ["unknown"],
          wordForms: ["unfamiliarly"],
        },
      }],
    });
    const retryLookup = vi.fn<DictionaryAdapter["lookup"]>(retryAdapter.lookup.bind(retryAdapter));
    const retryQueue = createQueueWithSources(database, repositories, [
      createDictionaryEnrichmentSource({
        settings: repositories.settings,
        dictionaryClient: createDictionaryClient({ ...retryAdapter, lookup: retryLookup }),
      }),
      createFakeLlmSource(),
    ]);

    await retryQueue.wake();

    expect(retryLookup).toHaveBeenCalledOnce();
    expect(await readField(repositories, saved.vocabularyItemId, "phonetic"))
      .toEqual(expect.objectContaining({ status: "ready", value: "/original/" }));
    expect(await readField(repositories, saved.vocabularyItemId, "synonyms"))
      .toEqual(expect.objectContaining({ status: "ready", value: ["unknown"] }));
    expect(await repositories.enrichmentJobs.listByVocabularyItem(saved.vocabularyItemId))
      .toHaveLength(0);
    expect(await database.learningCards.count()).toBe(1);
  });

  it("routes a Youdao failure through field retry and clears errors on success", async () => {
    const database = createTestDatabase("dictionary-client-retry");
    const repositories = createRepositories(database);
    const saved = await saveFixture(repositories);
    const success: DictionaryLookupResult = {
      providerId: "youdao-web",
      term: "unfamiliar",
      language: "en",
      fields: {
        phonetic: { status: "ready", type: "text", value: "/unfamiliar/" },
        partOfSpeech: { status: "ready", type: "text", value: "adjective" },
        meaning: { status: "ready", type: "text", value: "Not familiar" },
        synonyms: { status: "ready", type: "list", value: ["unknown"] },
        wordForms: { status: "ready", type: "list", value: ["unfamiliarly"] },
      },
    };
    const lookup = vi.fn<DictionaryAdapter["lookup"]>()
      .mockRejectedValueOnce(new DictionaryLookupError("timeout"))
      .mockResolvedValue(success);
    const source = createDictionaryEnrichmentSource({
      settings: repositories.settings,
      dictionaryClient: createDictionaryClient({
        capabilities: {
          providerId: "youdao-web",
          supportedLanguages: ["en"],
          supportedFields: ["phonetic", "partOfSpeech", "meaning", "synonyms", "wordForms"],
        },
        lookup,
      }),
    });
    const queue = createQueueWithSources(
      database,
      repositories,
      [source, createFakeLlmSource()],
    );

    await queue.wake();

    expect(await readField(repositories, saved.vocabularyItemId, "meaning"))
      .toEqual(expect.objectContaining({
        status: "failed",
        errorMessage: "The dictionary lookup timed out",
      }));
    expect(await repositories.enrichmentJobs.listByVocabularyItem(saved.vocabularyItemId))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ fieldKey: "meaning", status: "queued", attempts: 1 }),
      ]));

    await queue.wake();

    expect(lookup).toHaveBeenCalledTimes(2);
    expect(await readField(repositories, saved.vocabularyItemId, "meaning"))
      .toEqual(expect.objectContaining({ status: "ready", value: "Not familiar" }));
    expect(await repositories.enrichmentJobs.listByVocabularyItem(saved.vocabularyItemId))
      .toHaveLength(0);
    expect(await database.learningCards.count()).toBe(1);
  });

  it("keeps dictionary fields pending when no provider is configured", async () => {
    const database = createTestDatabase("no-provider");
    const repositories = createRepositories(database);
    const queue = createEnrichmentQueue({
      database,
      repositories: {
        enrichmentJobs: repositories.enrichmentJobs,
        learning: repositories.learning,
        vocabulary: repositories.vocabulary
      },
      sources: [createDictionaryEnrichmentSource({
        settings: repositories.settings,
      }), createFakeLlmSource()],
      clock,
      createId,
      maxAttempts: 3,
      initialBackoffMs: 0,
      maxBackoffMs: 0,
      claimTimeoutMs: 60_000
    });
    const saved = await saveFixture(repositories);

    await queue.wake();

    const jobs = await database.enrichmentJobs.toArray();
    expect(jobs).toHaveLength(5);
    expect(jobs.every((job) => job.status === "queued" && job.attempts === 0)).toBe(true);

    const fields = await database.vocabularyFields
      .where("vocabularyItemId")
      .equals(saved.vocabularyItemId)
      .toArray();
    expect(fields.filter((field) => field.status === "pending")).toHaveLength(5);
  });

  it("does not duplicate work across concurrent wake calls", async () => {
    const database = createTestDatabase("concurrency");
    const repositories = createRepositories(database);
    const queue = createQueue(database, repositories);
    const saved = await saveFixture(repositories);

    const [first, second] = await Promise.all([queue.wake(), queue.wake()]);
    await Promise.all([first, second]);

    const jobs = await database.enrichmentJobs.toArray();
    expect(jobs).toHaveLength(0);

    const fields = await database.vocabularyFields
      .where("vocabularyItemId")
      .equals(saved.vocabularyItemId)
      .toArray();
    expect(fields.filter((field) => field.status === "ready")).toHaveLength(7);
    const cards = await database.learningCards.toArray();
    expect(cards).toHaveLength(1);
  });

  it("preserves ready fields when one field fails and retries the failed field", async () => {
    const database = createTestDatabase("partial-failure");
    const repositories = createRepositories(database);
    const queue = createQueue(database, repositories, { failFields: ["meaning"] });
    const saved = await saveFixture(repositories);

    await queue.wake();

    const fieldsAfterFirst = await database.vocabularyFields
      .where("vocabularyItemId")
      .equals(saved.vocabularyItemId)
      .toArray();
    const byKeyAfterFirst = new Map(fieldsAfterFirst.map((field) => [field.key, field]));
    expect(byKeyAfterFirst.get("phonetic")).toEqual(expect.objectContaining({ status: "ready" }));
    expect(byKeyAfterFirst.get("meaning")).toEqual(expect.objectContaining({ status: "failed" }));
    expect(await database.learningCards.count()).toBe(0);

    const failedJobs = await database.enrichmentJobs.toArray();
    expect(failedJobs).toHaveLength(1);
    expect(failedJobs[0].fieldKey).toBe("meaning");

    const retryQueue = createQueue(database, repositories);
    await retryQueue.retryFailed(saved.vocabularyItemId);
    await retryQueue.wake();

    const fieldsAfterRetry = await database.vocabularyFields
      .where("vocabularyItemId")
      .equals(saved.vocabularyItemId)
      .toArray();
    const byKeyAfterRetry = new Map(fieldsAfterRetry.map((field) => [field.key, field]));
    expect(byKeyAfterRetry.get("meaning")).toEqual(expect.objectContaining({ status: "ready" }));
    expect(await database.learningCards.count()).toBe(1);
  });

  it("applies max attempts and stops retrying automatically", async () => {
    const database = createTestDatabase("max-attempts");
    const repositories = createRepositories(database);
    const queue = createQueue(database, repositories, { failFields: ["meaning"] });
    const saved = await saveFixture(repositories);

    await queue.wake();
    await queue.wake();
    await queue.wake();

    const job = await database.enrichmentJobs.get(`${saved.vocabularyItemId}:meaning:job`);
    expect(job).toEqual(expect.objectContaining({ status: "failed", attempts: 3 }));
  });

  it("recovers stale running jobs and completes them", async () => {
    const database = createTestDatabase("stale-recovery");
    const repositories = createRepositories(database);
    const saved = await saveFixture(repositories);

    await database.enrichmentJobs.update(`${saved.vocabularyItemId}:meaning:job`, {
      status: "running",
      nextRunAt: "2020-01-01T00:00:00.000Z",
      attempts: 1
    });

    const queue = createQueue(database, repositories);
    await queue.recover();
    await queue.wake();

    const job = await database.enrichmentJobs.get(`${saved.vocabularyItemId}:meaning:job`);
    expect(job).toBeUndefined();
    const meaningField = await database.vocabularyFields.get(`${saved.vocabularyItemId}:meaning`);
    expect(meaningField).toEqual(expect.objectContaining({ status: "ready" }));
  });

  it("completes queued work after a new worker instance opens the same database", async () => {
    const databaseName = "restart-resume";
    const firstDatabase = createTestDatabase(databaseName);
    const firstRepositories = createRepositories(firstDatabase);
    const saved = await saveFixture(firstRepositories);
    firstDatabase.close();

    const secondDatabase = createTestDatabase(databaseName);
    const secondRepositories = createRepositories(secondDatabase);
    const queue = createQueue(secondDatabase, secondRepositories);
    await queue.recover();
    await queue.wake();

    const jobs = await secondDatabase.enrichmentJobs.toArray();
    expect(jobs).toHaveLength(0);
    const cards = await secondDatabase.learningCards.toArray();
    expect(cards).toHaveLength(1);
  });

  it("recovers queued and stale running jobs after restart without rerunning failed or completed jobs", async () => {
    const databaseName = "restart-status-matrix";
    const firstDatabase = createTestDatabase(databaseName);
    const firstRepositories = createRepositories(firstDatabase);
    const saved = await saveFixture(firstRepositories);
    await firstDatabase.enrichmentJobs.bulkDelete([
      `${saved.vocabularyItemId}:synonyms:job`,
      `${saved.vocabularyItemId}:wordForms:job`,
    ]);
    await firstDatabase.enrichmentJobs.update(`${saved.vocabularyItemId}:partOfSpeech:job`, {
      status: "running",
      attempts: 1,
      nextRunAt: "2020-01-01T00:00:00.000Z",
    });
    await firstDatabase.enrichmentJobs.update(`${saved.vocabularyItemId}:meaning:job`, {
      status: "failed",
      attempts: 3,
    });
    await firstDatabase.enrichmentJobs.update(`${saved.vocabularyItemId}:examples:job`, {
      status: "succeeded",
      attempts: 1,
    } as never);
    firstDatabase.close();

    const secondDatabase = createTestDatabase(databaseName);
    const secondRepositories = createRepositories(secondDatabase);
    const queue = createQueue(secondDatabase, secondRepositories);
    await queue.recover();
    await queue.wake();

    expect(await secondDatabase.vocabularyFields.get(`${saved.vocabularyItemId}:phonetic`))
      .toEqual(expect.objectContaining({ status: "ready" }));
    expect(await secondDatabase.vocabularyFields.get(`${saved.vocabularyItemId}:partOfSpeech`))
      .toEqual(expect.objectContaining({ status: "ready" }));
    expect(await secondDatabase.enrichmentJobs.get(`${saved.vocabularyItemId}:meaning:job`))
      .toEqual(expect.objectContaining({ status: "failed", attempts: 3 }));
    expect(await secondDatabase.enrichmentJobs.get(`${saved.vocabularyItemId}:examples:job`))
      .toEqual(expect.objectContaining({ status: "succeeded", attempts: 1 }));
    expect(await secondDatabase.vocabularyFields.get(`${saved.vocabularyItemId}:examples`))
      .toEqual(expect.objectContaining({ status: "pending" }));
  });

  it("creates only one meaning-recall card per item", async () => {
    const database = createTestDatabase("idempotent-card");
    const repositories = createRepositories(database);
    const queue = createQueue(database, repositories);
    const saved = await saveFixture(repositories);

    await queue.wake();
    await queue.wake();
    await queue.wake();

    const cards = await database.learningCards.toArray();
    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe(`${saved.vocabularyItemId}:meaning-recall`);
  });

  it("does not overwrite a ready field when a redundant job is recovered", async () => {
    const database = createTestDatabase("preserve-ready-field");
    const repositories = createRepositories(database);
    const saved = await saveFixture(repositories);
    const fieldId = `${saved.vocabularyItemId}:phonetic`;
    const pendingField = await database.vocabularyFields.get(fieldId);
    if (!pendingField) {
      throw new Error("Expected the saved phonetic field");
    }
    await database.vocabularyFields.put({
      ...pendingField,
      status: "ready",
      value: "/existing/",
    } as VocabularyField);

    const queue = createQueue(database, repositories);
    await queue.wake();

    expect(await database.vocabularyFields.get(fieldId)).toEqual(
      expect.objectContaining({ status: "ready", value: "/existing/" }),
    );
    expect(await database.enrichmentJobs.get(`${saved.vocabularyItemId}:phonetic:job`))
      .toBeUndefined();
  });

  it("removes ready-field jobs before a missing-provider batch", async () => {
    const database = createTestDatabase("ready-field-missing-provider");
    const repositories = createRepositories(database);
    const saved = await saveFixture(repositories);
    const fieldId = `${saved.vocabularyItemId}:phonetic`;
    const pendingField = await database.vocabularyFields.get(fieldId);
    if (!pendingField) {
      throw new Error("Expected the saved phonetic field");
    }
    await database.vocabularyFields.put({
      ...pendingField,
      status: "ready",
      value: "/existing/",
    } as VocabularyField);
    await database.enrichmentJobs.bulkDelete([
      `${saved.vocabularyItemId}:partOfSpeech:job`,
      `${saved.vocabularyItemId}:examples:job`,
      `${saved.vocabularyItemId}:synonyms:job`,
      `${saved.vocabularyItemId}:wordForms:job`,
    ]);
    const source = createDictionaryEnrichmentSource({
      settings: repositories.settings,
    });
    const executeBatch = vi.spyOn(source, "executeBatch");
    const queue = createQueueWithSources(database, repositories, [source]);

    await queue.wake();

    expect(executeBatch).toHaveBeenCalledOnce();
    expect(executeBatch).toHaveBeenCalledWith(expect.objectContaining({
      jobs: [expect.objectContaining({ fieldKey: "meaning", attempts: 1 })],
    }));
    expect(await database.vocabularyFields.get(fieldId)).toEqual(
      expect.objectContaining({ status: "ready", value: "/existing/" }),
    );
    expect(await database.enrichmentJobs.get(`${saved.vocabularyItemId}:phonetic:job`))
      .toBeUndefined();
    expect(await database.enrichmentJobs.get(`${saved.vocabularyItemId}:meaning:job`))
      .toEqual(expect.objectContaining({ status: "queued", attempts: 0 }));
  });

  it("ignores a stale response after the job is reclaimed by a new worker", async () => {
    const database = createTestDatabase("stale-response-identity");
    const repositories = createRepositories(database);
    const saved = await saveFixture(repositories);
    const jobId = `${saved.vocabularyItemId}:meaning:job`;
    await database.enrichmentJobs.bulkDelete([
      `${saved.vocabularyItemId}:phonetic:job`,
      `${saved.vocabularyItemId}:partOfSpeech:job`,
      `${saved.vocabularyItemId}:examples:job`,
      `${saved.vocabularyItemId}:synonyms:job`,
      `${saved.vocabularyItemId}:wordForms:job`,
    ]);

    let resolveFirst: ((value: readonly import("./types").EnrichmentFieldResult[]) => void) | undefined;
    let resolveSecond: ((value: readonly import("./types").EnrichmentFieldResult[]) => void) | undefined;
    const firstSource: EnrichmentSource = {
      executeBatch: vi.fn(() => new Promise<readonly import("./types").EnrichmentFieldResult[]>((resolve) => { resolveFirst = resolve; })),
    };
    const secondSource: EnrichmentSource = {
      executeBatch: vi.fn(() => new Promise<readonly import("./types").EnrichmentFieldResult[]>((resolve) => { resolveSecond = resolve; })),
    };
    const firstWorker = createQueueWithSources(database, repositories, [firstSource]);
    const secondWorker = createQueueWithSources(database, repositories, [secondSource]);

    const firstWake = firstWorker.wake();
    await vi.waitFor(() => expect(firstSource.executeBatch).toHaveBeenCalledOnce());
    await database.enrichmentJobs.update(jobId, { status: "queued", nextRunAt: clock() });

    const secondWake = secondWorker.wake();
    await vi.waitFor(() => expect(secondSource.executeBatch).toHaveBeenCalledOnce());
    resolveFirst?.([{ jobId, fieldKey: "meaning", status: "ready", value: "stale meaning" }]);
    await firstWake;

    expect(await database.vocabularyFields.get(`${saved.vocabularyItemId}:meaning`))
      .toEqual(expect.objectContaining({ status: "pending" }));
    expect(await database.enrichmentJobs.get(jobId))
      .toEqual(expect.objectContaining({ status: "running", attempts: 2 }));

    resolveSecond?.([{ jobId, fieldKey: "meaning", status: "ready", value: "current meaning" }]);
    await secondWake;
    expect(await database.vocabularyFields.get(`${saved.vocabularyItemId}:meaning`))
      .toEqual(expect.objectContaining({ status: "ready", value: "current meaning" }));
  });

  it("does not create a card when meaning is not ready", async () => {
    const database = createTestDatabase("no-card-without-meaning");
    const repositories = createRepositories(database);
    const queue = createQueue(database, repositories, { failFields: ["meaning"] });
    await saveFixture(repositories);

    await queue.wake();
    await queue.wake();
    await queue.wake();

    const cards = await database.learningCards.toArray();
    expect(cards).toHaveLength(0);
  });
});

describe("save vocabulary transaction", () => {
  it("rolls back item, fields, context, and jobs when the transaction fails", async () => {
    const database = createTestDatabase("rollback");
    const repositories = createRepositories(database);

    const originalAdd = database.vocabularyFields.add.bind(database.vocabularyFields);
    vi.spyOn(database.vocabularyFields, "add").mockImplementation((async (field: unknown) => {
      const vocabularyField = field as VocabularyField;
      if (vocabularyField.key === "meaning") {
        throw new Error("simulated write failure");
      }
      return originalAdd(field as never) as never;
    }) as never);

    await expect(saveFixture(repositories)).rejects.toThrow("simulated write failure");

    expect(await database.vocabularyItems.count()).toBe(0);
    expect(await database.vocabularyFields.count()).toBe(0);
    expect(await database.vocabularyContexts.count()).toBe(0);
    expect(await database.enrichmentJobs.count()).toBe(0);
  });
});
