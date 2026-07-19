import type {
  ClientGeneratedId,
  EnrichmentJob,
  EnrichmentJobStatus,
  IsoDateTimeString,
  LearningCard,
  SyncMetadata,
  VocabularyField,
  VocabularyFieldFor,
  VocabularyFieldKey,
  VocabularyFieldValue,
  VocabularyItem
} from "@salto/core";

import type { SaltoDatabase } from "../db/database";
import type { LocalRepositories } from "../repositories";

import type { EnrichmentFieldResult, EnrichmentSource } from "./types";

export type EnrichmentQueueDependencies = {
  readonly database: SaltoDatabase;
  readonly repositories: Pick<LocalRepositories, "enrichmentJobs" | "learning" | "vocabulary">;
  readonly sources: readonly EnrichmentSource[];
  readonly clock: () => IsoDateTimeString;
  readonly createId: () => ClientGeneratedId;
  readonly maxAttempts: number;
  readonly initialBackoffMs: number;
  readonly maxBackoffMs: number;
  readonly claimTimeoutMs: number;
  readonly scheduleAlarm?: (when: IsoDateTimeString) => void;
};

export interface EnrichmentQueue {
  wake(): Promise<void>;
  recover(): Promise<void>;
  retryFailed(vocabularyItemId?: ClientGeneratedId): Promise<void>;
}

export function createEnrichmentQueue(dependencies: EnrichmentQueueDependencies): EnrichmentQueue {
  let isRunning = false;

  function now(): IsoDateTimeString {
    return dependencies.clock();
  }

  function computeNextRunAt(attempts: number): IsoDateTimeString {
    const delay = Math.min(
      dependencies.initialBackoffMs * 2 ** attempts,
      dependencies.maxBackoffMs
    );
    return new Date(new Date(now()).getTime() + delay).toISOString();
  }

  function createSyncMetadata(timestamp: IsoDateTimeString): SyncMetadata {
    return { createdAt: timestamp, updatedAt: timestamp, recordVersion: 1 };
  }

  async function loadItem(vocabularyItemId: ClientGeneratedId): Promise<VocabularyItem | undefined> {
    return dependencies.repositories.vocabulary.getItem(vocabularyItemId);
  }

  async function claimJob(job: EnrichmentJob): Promise<EnrichmentJob | undefined> {
    const claimExpiresAt = new Date(Date.now() + dependencies.claimTimeoutMs).toISOString();
    return dependencies.repositories.enrichmentJobs.updateStatus(
      job.id,
      "queued",
      "running",
      {
        attempts: job.attempts + 1,
        nextRunAt: claimExpiresAt
      }
    );
  }

  async function deleteJobIfFieldReady(job: EnrichmentJob): Promise<boolean> {
    const fieldId = `${job.vocabularyItemId}:${job.fieldKey}`;
    return dependencies.database.transaction(
      "rw",
      [dependencies.database.vocabularyFields, dependencies.database.enrichmentJobs],
      async () => {
        const [field, currentJob] = await Promise.all([
          dependencies.database.vocabularyFields.get(fieldId),
          dependencies.database.enrichmentJobs.get(job.id),
        ]);
        if (field?.status !== "ready" || currentJob?.status !== "queued") {
          return false;
        }
        await dependencies.database.enrichmentJobs.delete(job.id);
        return true;
      },
    );
  }

  async function updateFieldAndJob(
    job: EnrichmentJob,
    result: EnrichmentFieldResult,
    timestamp: IsoDateTimeString
  ): Promise<void> {
    const fieldId = `${job.vocabularyItemId}:${job.fieldKey}`;
    const existingField = await dependencies.database.vocabularyFields.get(fieldId);

    if (!existingField) {
      return;
    }

    await dependencies.database.transaction(
      "rw",
      [dependencies.database.vocabularyFields, dependencies.database.enrichmentJobs],
      async () => {
        const currentField = await dependencies.database.vocabularyFields.get(fieldId);
        const currentJob = await dependencies.database.enrichmentJobs.get(job.id);
        if (!currentField || !currentJob) {
          return;
        }
        if (currentField.status === "ready") {
          await dependencies.database.enrichmentJobs.delete(job.id);
          return;
        }

        const updatedField = buildUpdatedField(currentField, result, timestamp);
        await dependencies.database.vocabularyFields.put(updatedField);

        if (result.status === "ready") {
          await dependencies.database.enrichmentJobs.delete(job.id);
        } else {
          const attempts = currentJob.attempts;
          const failed = attempts >= dependencies.maxAttempts;
          const updatedJob: EnrichmentJob = {
            ...currentJob,
            status: failed ? "failed" : "queued",
            nextRunAt: failed ? currentJob.nextRunAt : computeNextRunAt(attempts),
            ...(result.status === "failed" && result.errorMessage
              ? { lastError: sanitizeError(result.errorMessage) }
              : {})
          } as EnrichmentJob;
          await dependencies.database.enrichmentJobs.put(updatedJob);
        }
      }
    );
  }

  function buildUpdatedField(
    field: VocabularyField,
    result: EnrichmentFieldResult,
    timestamp: IsoDateTimeString
  ): VocabularyField {
    const changed = result.status !== field.status;
    const base = {
      id: field.id,
      vocabularyItemId: field.vocabularyItemId,
      key: field.key,
      source: field.source,
      sync: changed ? bumpSyncMetadata(field.sync, timestamp) : field.sync
    };

    if (result.status === "ready") {
      if (result.value === undefined) {
        throw new Error(`Ready enrichment result for ${field.key} is missing a value`);
      }
      return { ...base, status: "ready", value: result.value } as unknown as VocabularyField;
    }

    if (result.status === "failed") {
      return {
        ...base,
        status: "failed",
        errorMessage: result.errorMessage ?? "Enrichment failed"
      } as unknown as VocabularyField;
    }

    return {
      ...base,
      status: "pending"
    } as unknown as VocabularyField;
  }

  function bumpSyncMetadata(sync: SyncMetadata, timestamp: IsoDateTimeString): SyncMetadata {
    return {
      ...sync,
      updatedAt: timestamp,
      recordVersion: sync.recordVersion + 1
    };
  }

  function sanitizeError(message: string): string {
    return message.slice(0, 500);
  }

  async function maybeGenerateCard(vocabularyItemId: ClientGeneratedId, timestamp: IsoDateTimeString): Promise<void> {
    const existingCard = await dependencies.repositories.learning.findCardByItemAndType(
      vocabularyItemId,
      "meaning-recall"
    );
    if (existingCard) {
      return;
    }

    const fields = await dependencies.repositories.vocabulary.listFields(vocabularyItemId);
    const termField = fields.find((field) => field.key === "term");
    const meaningField = fields.find((field) => field.key === "meaning");

    if (termField?.status === "ready" && meaningField?.status === "ready") {
      const card: LearningCard = {
        id: `${vocabularyItemId}:meaning-recall`,
        vocabularyItemId,
        cardType: "meaning-recall",
        frontFieldKeys: ["term"],
        backFieldKeys: ["meaning"],
        sync: createSyncMetadata(timestamp)
      };
      await dependencies.repositories.learning.saveCard(card);
    }
  }

  async function processItemJobs(item: VocabularyItem, jobs: readonly EnrichmentJob[]): Promise<void> {
    const timestamp = now();
    const claimedJobs: EnrichmentJob[] = [];

    for (const job of jobs) {
      if (await deleteJobIfFieldReady(job)) {
        continue;
      }
      const claimed = await claimJob(job);
      if (claimed) {
        claimedJobs.push(claimed);
      }
    }

    if (claimedJobs.length === 0) {
      return;
    }

    const request = {
      vocabularyItemId: item.id,
      term: item.term,
      language: item.language,
      jobs: claimedJobs
    };

    const resultMap = new Map<string, EnrichmentFieldResult>();
    for (const source of dependencies.sources) {
      const results = await source.executeBatch(request);
      for (const result of results) {
        if (!resultMap.has(result.jobId)) {
          resultMap.set(result.jobId, result);
        }
      }
    }

    for (const job of claimedJobs) {
      const result = resultMap.get(job.id);
      if (!result) {
        await dependencies.repositories.enrichmentJobs.updateStatus(
          job.id,
          "running",
          "queued",
          { attempts: Math.max(0, job.attempts - 1), nextRunAt: now() }
        );
        continue;
      }
      await updateFieldAndJob(job, result, timestamp);
    }

    await maybeGenerateCard(item.id, timestamp);
  }

  async function scheduleNextAlarm(): Promise<void> {
    if (!dependencies.scheduleAlarm) {
      return;
    }
    const queued = await dependencies.repositories.enrichmentJobs.listQueued(1000);
    const future = queued.filter((job) => job.nextRunAt > now());
    if (future.length === 0) {
      return;
    }
    const earliest = future.reduce((left, right) => (left.nextRunAt < right.nextRunAt ? left : right));
    dependencies.scheduleAlarm(earliest.nextRunAt);
  }

  async function doWake(): Promise<void> {
    const jobs = await dependencies.repositories.enrichmentJobs.listRunnable(100);
    const byItem = groupBy(jobs, (job) => job.vocabularyItemId);

    for (const [vocabularyItemId, itemJobs] of byItem.entries()) {
      const item = await loadItem(vocabularyItemId);
      if (!item) {
        continue;
      }
      await processItemJobs(item, itemJobs);
    }

    await scheduleNextAlarm();
  }

  return {
    async wake(): Promise<void> {
      if (isRunning) {
        return;
      }
      isRunning = true;
      try {
        await doWake();
      } finally {
        isRunning = false;
      }
    },

    async recover(): Promise<void> {
      const staleJobs = await dependencies.repositories.enrichmentJobs.listRunning();
      const nowString = now();
      for (const job of staleJobs) {
        if (job.nextRunAt <= nowString) {
          await dependencies.repositories.enrichmentJobs.updateStatus(
            job.id,
            "running",
            "queued",
            { nextRunAt: nowString }
          );
        }
      }
    },

    async retryFailed(vocabularyItemId?: ClientGeneratedId): Promise<void> {
      const failedJobs = vocabularyItemId
        ? (await dependencies.repositories.enrichmentJobs.listByVocabularyItem(vocabularyItemId))
          .filter((job) => job.status === "failed")
        : [];

      const nowString = now();
      for (const job of failedJobs) {
        await dependencies.repositories.enrichmentJobs.updateStatus(
          job.id,
          "failed",
          "queued",
          { nextRunAt: nowString }
        );
      }
    }
  };
}

function groupBy<T>(items: readonly T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }
  return map;
}
