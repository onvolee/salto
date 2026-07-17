import { normalizeLlmPublicConfig, type EnrichmentJob, type VocabularyFieldKey, type VocabularyFieldValue } from "@salto/core";

import type { LlmSettingsRepository } from "../repositories/local-repositories";
import {
  LlmRequestError,
  type OpenAiCompatibleClient,
} from "../llm/openai-compatible-client";

import type { EnrichmentBatchRequest, EnrichmentFieldResult, EnrichmentSource } from "./types";

export type LlmEnrichmentSourceDependencies = {
  readonly llmSettings: Pick<LlmSettingsRepository, "getCredentials">;
  readonly createClient: (
    config: NonNullable<Awaited<ReturnType<LlmSettingsRepository["getCredentials"]>>>["config"],
    secret: NonNullable<Awaited<ReturnType<LlmSettingsRepository["getCredentials"]>>>["secret"],
  ) => OpenAiCompatibleClient;
  readonly hasOriginPermission: (permissionOrigin: string) => Promise<boolean>;
};

const ENRICHMENT_INSTRUCTIONS: Record<"examples", string> = {
  examples:
    "Return example sentences using the term. Reply with a JSON object keyed by \"examples\" " +
    "containing an array of non-empty strings."
};

export function createLlmEnrichmentSource(
  dependencies: LlmEnrichmentSourceDependencies
): EnrichmentSource {
  return {
    async executeBatch(request: EnrichmentBatchRequest): Promise<readonly EnrichmentFieldResult[]> {
      const llmJobs = request.jobs.filter((job): job is EnrichmentJob & { fieldKey: "examples" } =>
        job.source === "llm" && job.fieldKey === "examples"
      );
      if (llmJobs.length === 0) {
        return [];
      }

      const credentials = await dependencies.llmSettings.getCredentials();
      if (!credentials) {
        return [];
      }

      const normalized = normalizeLlmPublicConfig(credentials.config);
      const originGranted = await dependencies.hasOriginPermission(normalized.permissionOrigin);
      if (!originGranted) {
        return [];
      }

      const client = dependencies.createClient(normalized.config, credentials.secret);
      const results: EnrichmentFieldResult[] = [];

      for (const job of llmJobs) {
        try {
          const output = await client.complete({
            fields: [{
              id: job.fieldKey,
              type: "list",
              instruction: ENRICHMENT_INSTRUCTIONS.examples.replace(/the term/g, request.term)
            }]
          });
          const value = extractListValue(output, job.fieldKey);
          if (value === undefined) {
            results.push({
              jobId: job.id,
              fieldKey: job.fieldKey,
              status: "failed",
              errorMessage: "The provider returned an invalid enrichment response"
            });
          } else {
            results.push({
              jobId: job.id,
              fieldKey: job.fieldKey,
              status: "ready",
              value
            });
          }
        } catch (error) {
          const message = error instanceof LlmRequestError
            ? error.message
            : "The provider request failed";
          results.push({
            jobId: job.id,
            fieldKey: job.fieldKey,
            status: "failed",
            errorMessage: message
          });
        }
      }

      return results;
    }
  };
}

function extractListValue(output: unknown, fieldKey: string): VocabularyFieldValue | undefined {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return undefined;
  }
  const value = (output as Record<string, unknown>)[fieldKey];
  if (Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim())) {
    return value as string[];
  }
  return undefined;
}
