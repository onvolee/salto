import {
  DictionaryLookupError,
  type DictionaryClient,
  type DictionaryQuerySchemaField,
  type QueryFieldResult,
} from "@salto/core";

import type { QueryExecutor } from "../services/background-services";

type DictionaryQueryExecutorDependencies = {
  readonly dictionaryClient: DictionaryClient;
  readonly llmExecutor: QueryExecutor;
};

function hasFieldId(value: unknown): value is { readonly fieldId: string } {
  return typeof value === "object"
    && value !== null
    && typeof (value as { readonly fieldId?: unknown }).fieldId === "string";
}

function mapDictionaryField(
  field: DictionaryQuerySchemaField,
  lookup: Awaited<ReturnType<DictionaryClient["lookup"]>>,
): QueryFieldResult {
  const result = lookup.fields[field.dictionaryField];
  if (result.status === "unavailable") {
    return { fieldId: field.id, status: "unavailable", reason: result.reason };
  }
  return result.type === "text"
    ? { fieldId: field.id, status: "ready", type: "text", value: result.value }
    : { fieldId: field.id, status: "ready", type: "list", value: result.value };
}

function dictionaryFailure(fieldId: string, error: unknown): QueryFieldResult {
  return error instanceof DictionaryLookupError
    ? {
      fieldId,
      status: "failed",
      error: { code: `dictionary-${error.code}`, message: error.message },
    }
    : {
      fieldId,
      status: "failed",
      error: {
        code: "dictionary-provider",
        message: "The dictionary provider request failed",
      },
    };
}

export function createDictionaryQueryExecutor(
  dependencies: DictionaryQueryExecutorDependencies,
): QueryExecutor {
  return {
    async execute(template, context, signal): Promise<readonly QueryFieldResult[]> {
      const activeFields = template.fields
        .filter((field) => field.enabled)
        .toSorted((left, right) => left.order - right.order);
      const dictionaryFields = activeFields.filter(
        (field): field is DictionaryQuerySchemaField => field.source === "dictionary",
      );
      const llmFields = activeFields.filter((field) => field.source === "llm");
      const activeSignal = signal ?? new AbortController().signal;
      const [llmOutcome, dictionaryOutcome] = await Promise.all([
        llmFields.length > 0
          ? dependencies.llmExecutor.execute(template, context, activeSignal).then(
            (results) => ({ results } as const),
            () => ({ error: true } as const),
          )
          : undefined,
        dictionaryFields.length > 0
          ? dependencies.dictionaryClient.lookup(
            { term: context.selection, language: "en" },
            activeSignal,
          ).then(
            (lookup) => ({ lookup } as const),
            (error: unknown) => ({ error } as const),
          )
          : undefined,
      ]);
      const llmResults = llmOutcome && "results" in llmOutcome && Array.isArray(llmOutcome.results)
        ? llmOutcome.results.filter(hasFieldId)
        : [];
      const llmFailed = Boolean(llmOutcome && "error" in llmOutcome);

      const results = activeFields.flatMap((field) => {
        if (field.source === "dictionary") {
          if (!dictionaryOutcome) {
            return [];
          }
          return "lookup" in dictionaryOutcome
            ? [mapDictionaryField(field, dictionaryOutcome.lookup)]
            : [dictionaryFailure(field.id, dictionaryOutcome.error)];
        }
        if (llmFailed) {
          return [{
            fieldId: field.id,
            status: "failed" as const,
            error: {
              code: "llm-query",
              message: "The LLM query could not be completed",
            },
          }];
        }
        return llmResults.filter((result) => result.fieldId === field.id) as QueryFieldResult[];
      });
      const activeFieldIds = new Set(activeFields.map((field) => field.id));
      const unexpectedLlmResults = llmResults.filter((result) => !activeFieldIds.has(result.fieldId));
      return [...results, ...unexpectedLlmResults] as QueryFieldResult[];
    },
  };
}
