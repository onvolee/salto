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
  const result = lookup.fields[field.content.dictionaryField];
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
    async execute(template, context, signal, onFieldReady): Promise<readonly QueryFieldResult[]> {
      const activeFields = template.fields
        .filter((field) => field.enabled)
        .toSorted((left, right) => left.order - right.order);
      const dictionaryFields = activeFields.filter(
        (field): field is DictionaryQuerySchemaField => field.content.source === "dictionary",
      );
      const llmFields = activeFields.filter((field) => field.content.source === "llm");
      const activeSignal = signal ?? new AbortController().signal;
      
      const allResults: QueryFieldResult[] = [];
      const llmFieldIds = new Set(llmFields.map((field) => field.id));
      
      const llmPromise = llmFields.length > 0
        ? dependencies.llmExecutor.execute(template, context, activeSignal).then(
            (results) => {
              if (Array.isArray(results)) {
                const llmResults = results.filter(hasFieldId).filter((result) => llmFieldIds.has(result.fieldId));
                llmResults.forEach((result) => {
                  const fieldResult = result as QueryFieldResult;
                  allResults.push(fieldResult);
                  onFieldReady?.(fieldResult);
                });
              }
              return { results } as const;
            },
            () => {
              llmFields.forEach((field) => {
                const result = {
                  fieldId: field.id,
                  status: "failed" as const,
                  error: {
                    code: "llm-query",
                    message: "The LLM query could not be completed",
                  },
                };
                allResults.push(result);
                onFieldReady?.(result);
              });
              return { error: true } as const;
            },
          )
        : Promise.resolve(undefined);
      
      const dictionaryPromise = dictionaryFields.length > 0
        ? dependencies.dictionaryClient.lookup(
            { term: context.selection, language: "en" },
            activeSignal,
          ).then(
            (lookup) => {
              dictionaryFields.forEach((field) => {
                const result = mapDictionaryField(field, lookup);
                allResults.push(result);
                onFieldReady?.(result);
              });
              return { lookup } as const;
            },
            (error: unknown) => {
              dictionaryFields.forEach((field) => {
                const result = dictionaryFailure(field.id, error);
                allResults.push(result);
                onFieldReady?.(result);
              });
              return { error } as const;
            },
          )
        : Promise.resolve(undefined);
      
      await Promise.all([llmPromise, dictionaryPromise]);
      
      const activeFieldIds = new Set(activeFields.map((field) => field.id));
      const unexpectedResults = allResults.filter((result) => !activeFieldIds.has(result.fieldId));
      return [...allResults, ...unexpectedResults];
    },
  };
}
