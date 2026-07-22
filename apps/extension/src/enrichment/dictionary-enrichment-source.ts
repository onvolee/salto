import {
  DictionaryLookupError,
  type DictionaryClient,
  type EnrichmentJob,
} from "@salto/core";

import type { SettingsRepository } from "../repositories/local-repositories";

import { createDeterministicDictionaryFake } from "./deterministic-dictionary-fake";
import type { EnrichmentBatchRequest, EnrichmentFieldResult, EnrichmentSource } from "./types";

export type DictionaryEnrichmentSourceDependencies = {
  readonly settings: Pick<SettingsRepository, "getActive">;
  readonly dictionaryClient?: DictionaryClient;
  readonly useDeterministicFake?: boolean;
};

export function createDictionaryEnrichmentSource(
  dependencies: DictionaryEnrichmentSourceDependencies
): EnrichmentSource {
  const fake = createDeterministicDictionaryFake();

  return {
    async executeBatch(request: EnrichmentBatchRequest): Promise<readonly EnrichmentFieldResult[]> {
      const dictionaryJobs = request.jobs.filter(
        (job): job is Extract<EnrichmentJob, { readonly source: "dictionary" }> => (
          job.source === "dictionary"
        )
      );
      if (dictionaryJobs.length === 0) {
        return [];
      }

      if (dependencies.useDeterministicFake) {
        return fake.executeBatch(request);
      }

      const { settings } = await dependencies.settings.getActive();
      if (
        settings.activeDictionaryProvider !== "youdao-web"
        || !dependencies.dictionaryClient
      ) {
        return [];
      }

      let lookup: Awaited<ReturnType<DictionaryClient["lookup"]>>;
      try {
        lookup = await dependencies.dictionaryClient.lookup(
          { term: request.term, language: request.language },
          new AbortController().signal
        );
      } catch (error) {
        if (error instanceof DictionaryLookupError && error.code === "permission-denied") {
          return [];
        }
        const errorMessage = error instanceof DictionaryLookupError
          ? error.message
          : "The dictionary provider request failed";
        return dictionaryJobs.map((job) => ({
          jobId: job.id,
          fieldKey: job.fieldKey,
          status: "failed" as const,
          errorMessage
        }));
      }

      return dictionaryJobs.map((job) => {
        const field = lookup.fields[job.fieldKey];
        return field.status === "ready"
          ? {
            jobId: job.id,
            fieldKey: job.fieldKey,
            status: "ready" as const,
            value: field.value
          }
          : {
            jobId: job.id,
            fieldKey: job.fieldKey,
            status: "unavailable" as const
          };
      });
    }
  };
}
