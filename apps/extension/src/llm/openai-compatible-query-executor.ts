import {
  normalizeLlmPublicConfig,
  renderLlmQueryFields,
  type LlmQuerySchemaField,
  type PromptContext,
  type QueryFieldResult,
  type QueryTemplate,
} from "@salto/core";

import type { LlmSettingsRepository } from "../repositories/local-repositories";
import {
  LlmRequestError,
  type OpenAiCompatibleClient,
} from "./openai-compatible-client";

type QueryExecutorDependencies = {
  readonly llmSettings: Pick<LlmSettingsRepository, "getCredentials">;
  readonly createClient: (
    config: NonNullable<Awaited<ReturnType<LlmSettingsRepository["getCredentials"]>>>["config"],
    secret: NonNullable<Awaited<ReturnType<LlmSettingsRepository["getCredentials"]>>>["secret"],
  ) => OpenAiCompatibleClient;
  readonly hasOriginPermission: (permissionOrigin: string) => Promise<boolean>;
};

function failedField(
  fieldId: string,
  code: string,
  message: string,
): QueryFieldResult {
  return { fieldId, status: "failed", error: { code, message } };
}

function failureForRequest(fieldId: string, error: unknown): QueryFieldResult {
  if (error instanceof LlmRequestError) {
    return failedField(fieldId, `llm-${error.code}`, error.message);
  }
  return failedField(fieldId, "llm-provider", "The provider request failed");
}

function resultForValue(
  field: QueryTemplate["fields"][number],
  value: unknown,
): QueryFieldResult {
  if (value === undefined) {
    return failedField(
      field.id,
      "missing-field-result",
      "The provider did not return this field",
    );
  }
  if (field.content.type === "text") {
    return typeof value === "string" && value.trim()
      ? { fieldId: field.id, status: "ready", type: "text", value }
      : failedField(
        field.id,
        "invalid-field-result",
        "The provider returned an invalid field result",
      );
  }
  return Array.isArray(value)
    && value.every((item) => typeof item === "string" && item.trim())
    ? { fieldId: field.id, status: "ready", type: "list", value }
    : failedField(
      field.id,
      "invalid-field-result",
      "The provider returned an invalid field result",
    );
}

export function createOpenAiCompatibleQueryExecutor(
  dependencies: QueryExecutorDependencies,
) {
  return {
    async execute(
      template: QueryTemplate,
      context: PromptContext,
      signal?: AbortSignal,
    ): Promise<readonly QueryFieldResult[]> {
      const activeFields = template.fields
        .filter((field) => field.enabled)
        .toSorted((left, right) => left.order - right.order);
      const llmFields = activeFields.filter(
        (field): field is LlmQuerySchemaField => field.content.source === "llm",
      );
      const dictionaryResults: QueryFieldResult[] = activeFields
        .filter((field) => field.content.source === "dictionary")
        .map((field) => ({
          fieldId: field.id,
          status: "unavailable",
          reason: "not-configured",
        }));

      if (llmFields.length === 0) {
        return dictionaryResults;
      }

      const credentials = await dependencies.llmSettings.getCredentials();
      if (!credentials) {
        return [
          ...llmFields.map((field) => ({
            fieldId: field.id,
            status: "unavailable" as const,
            reason: "not-configured" as const,
          })),
          ...dictionaryResults,
        ];
      }

      const normalized = normalizeLlmPublicConfig(credentials.config);
      const rendered = renderLlmQueryFields(llmFields, context);
      if (!await dependencies.hasOriginPermission(normalized.permissionOrigin)) {
        return [
          ...llmFields.map((field) => failedField(
            field.id,
            "permission-denied",
            "Provider permission is not granted",
          )),
          ...dictionaryResults,
        ];
      }

      if (rendered.fields.length === 0) {
        return [...rendered.failures, ...dictionaryResults];
      }

      let output: unknown;
      try {
        output = await dependencies.createClient(
          normalized.config,
          credentials.secret,
        ).complete({ fields: rendered.fields, signal });
      } catch (error) {
        return [
          ...rendered.failures,
          ...rendered.fields.map((field) => failureForRequest(field.id, error)),
          ...dictionaryResults,
        ];
      }

      if (!output || typeof output !== "object" || Array.isArray(output)) {
        return [
          ...rendered.failures,
          ...rendered.fields.map((field) => failedField(
            field.id,
            "invalid-provider-response",
            "The provider returned an invalid response",
          )),
          ...dictionaryResults,
        ];
      }

      const values = output as Record<string, unknown>;
      const fieldById = new Map(llmFields.map((field) => [field.id, field]));
      const results = llmFields.map((field) => {
        const promptFailure = rendered.failures.find((result) => result.fieldId === field.id);
        return promptFailure ?? resultForValue(field, values[field.id]);
      });
      const unexpected = Object.keys(values)
        .filter((fieldId) => !fieldById.has(fieldId))
        .map((fieldId) => failedField(
          fieldId,
          "unexpected-field-result",
          "The provider returned an unexpected field result",
        ));

      return [...results, ...unexpected, ...dictionaryResults];
    },
  };
}

export type OpenAiCompatibleQueryExecutor = ReturnType<
  typeof createOpenAiCompatibleQueryExecutor
>;
