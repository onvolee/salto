import type { ExtensionSettings } from "@salto/core";

import type { SettingsRepository } from "../repositories/local-repositories";

import { createDeterministicDictionaryFake } from "./deterministic-dictionary-fake";
import type { EnrichmentBatchRequest, EnrichmentFieldResult, EnrichmentSource } from "./types";

export type DictionaryEnrichmentSourceDependencies = {
  readonly settings: Pick<SettingsRepository, "getActive">;
  readonly useDeterministicFake?: boolean;
};

export function createDictionaryEnrichmentSource(
  dependencies: DictionaryEnrichmentSourceDependencies
): EnrichmentSource {
  const fake = createDeterministicDictionaryFake();

  return {
    async executeBatch(request: EnrichmentBatchRequest): Promise<readonly EnrichmentFieldResult[]> {
      const dictionaryJobs = request.jobs.filter((job) => job.source === "dictionary");
      if (dictionaryJobs.length === 0) {
        return [];
      }

      if (dependencies.useDeterministicFake) {
        return fake.executeBatch(request);
      }

      const { settings } = await dependencies.settings.getActive();
      if (!settings.activeDictionaryProvider) {
        return [];
      }

      return [];
    }
  };
}
