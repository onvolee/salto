import type {
  ExtensionRequest,
  ExtensionResponse,
  PromptContext,
  QueryFieldResult,
  QueryTemplate
} from "@salto/core";

import type { LocalRepositories } from "../repositories";

export interface QueryExecutor {
  execute(
    template: QueryTemplate,
    context: PromptContext
  ): Promise<unknown>;
}

export type BackgroundServiceDependencies = {
  readonly repositories: LocalRepositories;
  readonly queryExecutor: QueryExecutor;
};

const PROMPT_CONTEXT_KEYS = [
  "selection",
  "sentence",
  "paragraphs",
  "targetLanguage",
  "webTitle",
  "webUrl",
  "webContent"
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasProviderFieldId(value: unknown): value is Record<string, unknown> & { readonly fieldId: string } {
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

function isSavePayload(value: unknown): value is Extract<ExtensionRequest, { type: "save-vocabulary" }>["payload"] {
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
    && ["sentence", "paragraphs", "pageTitle", "pageUrl"].every((key) => typeof context[key] === "string");
}

export function parseExtensionRequest(value: unknown): ExtensionRequest | null | "unknown" {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }

  if (value.type === "translate-selection") {
    return isRecord(value.payload) && isPromptContext(value.payload.context)
      ? { type: value.type, payload: { context: value.payload.context } }
      : null;
  }
  if (value.type === "save-vocabulary") {
    return isSavePayload(value.payload) ? { type: value.type, payload: value.payload } : null;
  }
  if (value.type === "list-highlight-terms") {
    return { type: value.type };
  }
  return "unknown";
}

function errorResponse(
  code: "unknown-message" | "invalid-payload" | "request-failed",
  message: string
): ExtensionResponse {
  return { ok: false, error: { code, message } };
}

function isValidFieldResult(
  value: unknown,
  field: QueryTemplate["fields"][number]
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
        && value.value.length > 0
        && value.value.every((item) => typeof item === "string" && item.trim().length > 0);
  }
  if (value.status === "unavailable") {
    return ["not-configured", "not-found", "unsupported", "missing"].includes(value.reason as string);
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

export function createBackgroundServices(dependencies: BackgroundServiceDependencies) {
  return {
    async handleMessage(value: unknown): Promise<ExtensionResponse> {
      const request = parseExtensionRequest(value);
      if (request === "unknown") {
        return errorResponse("unknown-message", "Unsupported extension message");
      }
      if (!request) {
        return errorResponse("invalid-payload", "Invalid extension message payload");
      }

      try {
        if (request.type === "translate-selection") {
          const { settings, template } = await dependencies.repositories.settings.getActive();
          const context = { ...request.payload.context, targetLanguage: settings.targetLanguage };
          const rawOutput = await dependencies.queryExecutor.execute(template, context);
          const activeFields = template.fields
            .filter((field) => field.enabled)
            .toSorted((left, right) => left.order - right.order);
          const activeFieldIds = new Set(activeFields.map(({ id }) => id));
          if (
            !Array.isArray(rawOutput)
            || !rawOutput.every(hasProviderFieldId)
          ) {
            throw new Error("Invalid provider output shape");
          }
          const rawFields = rawOutput;
          const fields = activeFields.map((field) => {
            const results = rawFields.filter((candidate) => {
              return candidate.fieldId === field.id;
            });
            if (results.length === 0) {
              return failedField(
                field.id,
                "missing-field-result",
                "The provider did not return this field"
              );
            }
            if (results.length > 1) {
              return failedField(
                field.id,
                "duplicate-field-result",
                "The provider returned this field more than once"
              );
            }
            const result = results[0];
            if (!isValidFieldResult(result, field)) {
              return failedField(
                field.id,
                "invalid-field-result",
                "The provider returned an invalid field result"
              );
            }
            return result;
          });
          const unexpectedFields = rawFields
            .filter((result) => !activeFieldIds.has(result.fieldId))
            .map((result) => failedField(
              result.fieldId,
              "unexpected-field-result",
              "The provider returned an unexpected field result"
            ));
          return {
            ok: true,
            type: request.type,
            data: {
              templateId: template.id,
              templateName: template.name,
              schema: activeFields.map(({ id, label }) => ({ id, label })),
              fields: [...fields, ...unexpectedFields]
            }
          };
        }
        if (request.type === "save-vocabulary") {
          return {
            ok: true,
            type: request.type,
            data: await dependencies.repositories.vocabulary.save(request.payload)
          };
        }
        const { settings } = await dependencies.repositories.settings.getActive();
        return {
          ok: true,
          type: request.type,
          data: {
            terms: settings.highlightEnabled
              ? await dependencies.repositories.highlightTerms.list()
              : []
          }
        };
      } catch {
        return errorResponse("request-failed", "The extension request could not be completed");
      }
    }
  };
}

export type BackgroundServices = ReturnType<typeof createBackgroundServices>;
