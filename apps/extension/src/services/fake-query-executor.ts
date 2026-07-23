import type { PromptContext, QueryFieldResult, QuerySchemaField } from "@salto/core";

import type { QueryExecutor } from "./background-services";

export function createFakeQueryExecutor(): QueryExecutor {
  return {
    async execute(template, context) {
      return template.fields
        .filter((field) => field.enabled)
        .toSorted((left, right) => left.order - right.order)
        .map((field) => fakeFieldResult(field, context));
    }
  };
}

function fakeFieldResult(field: QuerySchemaField, context: PromptContext): QueryFieldResult {
  if (field.content.source === "dictionary") {
    return { fieldId: field.id, status: "unavailable", reason: "not-configured" };
  }
  if (field.content.type === "list") {
    return {
      fieldId: field.id,
      status: "ready",
      type: "list",
      value: [`Fake key point 1: ${context.selection}`, `Fake key point 2: ${context.targetLanguage}`]
    };
  }
  return {
    fieldId: field.id,
    status: "ready",
    type: "text",
    value: `Fake translation: ${context.selection} -> ${context.targetLanguage}`
  };
}
