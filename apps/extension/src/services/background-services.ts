import {
  analyzeLlmPromptFields,
  LlmConfigError,
  normalizeLlmPublicConfig,
  type ExtensionErrorCode,
  type ExtensionRequest,
  type ExtensionResponse,
  type LlmPublicConfig,
  type LlmQuerySchemaField,
  type PromptContext,
  type QueryFieldResult,
  type QueryTemplate,
} from "@salto/core";

import type { SaveVocabularyService } from "@salto/core";
import type { LocalRepositories } from "../repositories";
import type { EnrichmentQueue } from "../enrichment/enrichment-queue";

export interface QueryExecutor {
  execute(
    template: QueryTemplate,
    context: PromptContext,
    signal?: AbortSignal,
  ): Promise<unknown>;
}

export type BackgroundMessageContext = {
  readonly source: "content-script" | "extension-page" | "unknown";
};

export type BackgroundServiceDependencies = {
  readonly repositories: LocalRepositories;
  readonly saveVocabulary: SaveVocabularyService;
  readonly enrichmentQueue: EnrichmentQueue;
  readonly queryExecutor: QueryExecutor;
  readonly hasOriginPermission?: (permissionOrigin: string) => Promise<boolean>;
  readonly testLlmConnection?: () => Promise<void>;
};

const PROMPT_CONTEXT_KEYS = [
  "selection",
  "sentence",
  "paragraphs",
  "targetLanguage",
  "webTitle",
  "webUrl",
  "webContent",
] as const;

class ServiceError extends Error {
  constructor(
    readonly code: ExtensionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasProviderFieldId(
  value: unknown,
): value is Record<string, unknown> & { readonly fieldId: string } {
  return isRecord(value) && typeof value.fieldId === "string";
}

function isPromptContext(value: unknown): value is PromptContext {
  if (!isRecord(value) || !PROMPT_CONTEXT_KEYS.every((key) => typeof value[key] === "string")) {
    return false;
  }
  const selection = value.selection as string;
  const webContent = value.webContent as string;
  return selection.trim().length > 0 && selection.length <= 500 && webContent.length <= 2000;
}

function isSavePayload(
  value: unknown,
): value is Extract<ExtensionRequest, { type: "save-vocabulary" }>["payload"] {
  if (
    !isRecord(value)
    || typeof value.term !== "string"
    || value.term.length > 500
    || value.term.trim().length === 0
    || value.language !== "en"
  ) {
    return false;
  }
  const context = value.context;
  return isRecord(context)
    && ["sentence", "paragraphs", "pageTitle", "pageUrl"].every(
      (key) => typeof context[key] === "string",
    );
}

function isLlmPublicConfig(value: unknown): value is LlmPublicConfig {
  return isRecord(value)
    && value.provider === "openai-compatible"
    && typeof value.baseUrl === "string"
    && typeof value.model === "string"
    && (value.temperature === undefined || typeof value.temperature === "number");
}

export function parseExtensionRequest(
  value: unknown,
): ExtensionRequest | null | "unknown" {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }
  if (value.type === "translate-selection") {
    return isRecord(value.payload)
      && typeof value.payload.requestId === "string"
      && value.payload.requestId.length > 0
      && isPromptContext(value.payload.context)
      ? {
        type: value.type,
        payload: {
          requestId: value.payload.requestId,
          context: value.payload.context,
        },
      }
      : null;
  }
  if (value.type === "cancel-translation") {
    return isRecord(value.payload)
      && typeof value.payload.requestId === "string"
      && value.payload.requestId.length > 0
      ? { type: value.type, payload: { requestId: value.payload.requestId } }
      : null;
  }
  if (value.type === "save-vocabulary") {
    return isSavePayload(value.payload) ? { type: value.type, payload: value.payload } : null;
  }
  if (value.type === "retry-enrichment") {
    return {
      type: value.type,
      payload: isRecord(value.payload) && typeof value.payload.vocabularyItemId === "string"
        ? { vocabularyItemId: value.payload.vocabularyItemId }
        : {}
    };
  }
  if (value.type === "list-failed-enrichment") {
    return { type: value.type };
  }
  if (
    value.type === "list-highlight-terms"
    || value.type === "get-llm-config"
    || value.type === "test-llm-connection"
  ) {
    return { type: value.type };
  }
  if (value.type === "save-llm-config") {
    return isRecord(value.payload)
      && isLlmPublicConfig(value.payload.config)
      && (value.payload.apiKey === undefined || typeof value.payload.apiKey === "string")
      ? {
        type: value.type,
        payload: {
          config: value.payload.config,
          ...(typeof value.payload.apiKey === "string"
            ? { apiKey: value.payload.apiKey }
            : {}),
        },
      }
      : null;
  }
  return "unknown";
}

function errorResponse(
  code: ExtensionErrorCode,
  message: string,
): ExtensionResponse {
  return { ok: false, error: { code, message } };
}

function isValidFieldResult(
  value: unknown,
  field: QueryTemplate["fields"][number],
): value is QueryFieldResult {
  if (!isRecord(value) || value.fieldId !== field.id || typeof value.status !== "string") {
    return false;
  }
  if (value.status === "ready") {
    if (value.type !== field.type) {
      return false;
    }
    return value.type === "text"
      ? typeof value.value === "string" && value.value.trim().length > 0
      : Array.isArray(value.value)
        && value.value.every((item) => typeof item === "string" && item.trim().length > 0);
  }
  if (value.status === "unavailable") {
    return ["not-configured", "not-found", "unsupported", "missing"].includes(
      value.reason as string,
    );
  }
  if (value.status === "failed") {
    return isRecord(value.error)
      && typeof value.error.code === "string"
      && typeof value.error.message === "string";
  }
  return false;
}

function failedField(fieldId: string, code: string, message: string): QueryFieldResult {
  return { fieldId, status: "failed", error: { code, message } };
}

function assertExtensionPage(context: BackgroundMessageContext) {
  if (context.source !== "extension-page") {
    throw new ServiceError("forbidden", "This request is available only from extension settings");
  }
}

function mapUnknownError(error: unknown): ExtensionResponse {
  if (error instanceof ServiceError) {
    return errorResponse(error.code, error.message);
  }
  if (error instanceof LlmConfigError) {
    return errorResponse("configuration-invalid", error.message);
  }
  if (isRecord(error) && typeof error.code === "string") {
    const code = error.code.replace(/^llm-/, "") as ExtensionErrorCode;
    const allowed = new Set<ExtensionErrorCode>([
      "authentication",
      "invalid-response",
      "model-not-found",
      "network",
      "not-configured",
      "permission-denied",
      "provider",
      "rate-limit",
      "timeout",
    ]);
    if (allowed.has(code)) {
      return errorResponse(code, typeof error.message === "string" ? error.message : "Provider request failed");
    }
  }
  return errorResponse("request-failed", "The extension request could not be completed");
}

export function createBackgroundServices(dependencies: BackgroundServiceDependencies) {
  const translationControllers = new Map<string, AbortController>();

  return {
    async handleMessage(
      value: unknown,
      context: BackgroundMessageContext = { source: "unknown" },
    ): Promise<ExtensionResponse> {
      const request = parseExtensionRequest(value);
      if (request === "unknown") {
        return errorResponse("unknown-message", "Unsupported extension message");
      }
      if (!request) {
        return errorResponse("invalid-payload", "Invalid extension message payload");
      }

      try {
        if (request.type === "cancel-translation") {
          const controller = translationControllers.get(request.payload.requestId);
          controller?.abort();
          translationControllers.delete(request.payload.requestId);
          return {
            ok: true,
            type: request.type,
            data: { cancelled: Boolean(controller) },
          };
        }

        if (request.type === "translate-selection") {
          translationControllers.get(request.payload.requestId)?.abort();
          const controller = new AbortController();
          translationControllers.set(request.payload.requestId, controller);
          try {
            const { settings, template } = await dependencies.repositories.settings.getActive();
            const promptContext = {
              ...request.payload.context,
              targetLanguage: settings.targetLanguage,
            };
            const rawOutput = await dependencies.queryExecutor.execute(
              template,
              promptContext,
              controller.signal,
            );
            const activeFields = template.fields
              .filter((field) => field.enabled)
              .toSorted((left, right) => left.order - right.order);
            const activeFieldIds = new Set(activeFields.map(({ id }) => id));
            if (!Array.isArray(rawOutput) || !rawOutput.every(hasProviderFieldId)) {
              throw new Error("Invalid provider output shape");
            }
            const fields = activeFields.map((field) => {
              const results = rawOutput.filter((candidate) => candidate.fieldId === field.id);
              if (results.length === 0) {
                return failedField(
                  field.id,
                  "missing-field-result",
                  "The provider did not return this field",
                );
              }
              if (results.length > 1) {
                return failedField(
                  field.id,
                  "duplicate-field-result",
                  "The provider returned this field more than once",
                );
              }
              return isValidFieldResult(results[0], field)
                ? results[0]
                : failedField(
                  field.id,
                  "invalid-field-result",
                  "The provider returned an invalid field result",
                );
            });
            const unexpectedFields = rawOutput
              .filter((result) => !activeFieldIds.has(result.fieldId))
              .map((result) => failedField(
                result.fieldId,
                "unexpected-field-result",
                "The provider returned an unexpected field result",
              ));
            return {
              ok: true,
              type: request.type,
              data: {
                templateId: template.id,
                templateName: template.name,
                schema: activeFields.map(({ id, label }) => ({ id, label })),
                fields: [...fields, ...unexpectedFields],
              },
            };
          } finally {
            if (translationControllers.get(request.payload.requestId) === controller) {
              translationControllers.delete(request.payload.requestId);
            }
          }
        }

        if (request.type === "save-vocabulary") {
          const result = await dependencies.saveVocabulary.save(request.payload);
          void dependencies.enrichmentQueue.wake();
          return {
            ok: true,
            type: request.type,
            data: result,
          };
        }

        if (request.type === "retry-enrichment") {
          await dependencies.enrichmentQueue.retryFailed(request.payload?.vocabularyItemId);
          void dependencies.enrichmentQueue.wake();
          return {
            ok: true,
            type: request.type,
            data: { reset: 0 },
          };
        }

        if (request.type === "list-failed-enrichment") {
          const failedJobs = await dependencies.repositories.enrichmentJobs.listFailed();
          const byItem = new Map<string, string[]>();
          for (const job of failedJobs) {
            const fields = byItem.get(job.vocabularyItemId) ?? [];
            fields.push(job.fieldKey);
            byItem.set(job.vocabularyItemId, fields);
          }
          const items: { readonly vocabularyItemId: string; readonly term: string; readonly fields: readonly string[] }[] = [];
          for (const [vocabularyItemId, fields] of byItem.entries()) {
            const item = await dependencies.repositories.vocabulary.getItem(vocabularyItemId);
            if (item) {
              items.push({ vocabularyItemId, term: item.term, fields });
            }
          }
          return {
            ok: true,
            type: request.type,
            data: { items },
          };
        }

        if (request.type === "list-highlight-terms") {
          const { settings } = await dependencies.repositories.settings.getActive();
          return {
            ok: true,
            type: request.type,
            data: {
              terms: settings.highlightEnabled
                ? await dependencies.repositories.highlightTerms.list()
                : [],
            },
          };
        }

        if (request.type === "get-llm-config") {
          const [llmState, { template }] = await Promise.all([
            dependencies.repositories.llmSettings.getPublicState(),
            dependencies.repositories.settings.getActive(),
          ]);
          const llmFields = template.fields.filter((field): field is LlmQuerySchemaField => (
            field.enabled && field.source === "llm"
          ));
          return {
            ok: true,
            type: request.type,
            data: {
              ...llmState,
              promptAnalysis: analyzeLlmPromptFields(llmFields),
            },
          };
        }

        assertExtensionPage(context);
        if (request.type === "save-llm-config") {
          const normalized = normalizeLlmPublicConfig(request.payload.config);
          if (!await dependencies.hasOriginPermission?.(normalized.permissionOrigin)) {
            throw new ServiceError("permission-denied", "Provider permission is not granted");
          }
          const apiKey = request.payload.apiKey?.trim();
          await dependencies.repositories.llmSettings.save(
            normalized.config,
            apiKey ? { apiKey } : undefined,
          );
          return {
            ok: true,
            type: request.type,
            data: await dependencies.repositories.llmSettings.getPublicState(),
          };
        }

        if (!dependencies.testLlmConnection) {
          throw new ServiceError("not-configured", "LLM connection testing is unavailable");
        }
        await dependencies.testLlmConnection();
        return {
          ok: true,
          type: request.type,
          data: { connected: true },
        };
      } catch (error) {
        return mapUnknownError(error);
      }
    },
  };
}

export type BackgroundServices = ReturnType<typeof createBackgroundServices>;
