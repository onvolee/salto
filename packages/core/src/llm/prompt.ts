import type {
  LlmQuerySchemaField,
  PromptContext,
  QueryFieldResult,
} from "../query-template/types";
import type { LlmCompletionField } from "./types";
import type {
  PromptContextVariable,
  PromptTemplateAnalysis,
} from "./types";

export const PROMPT_CONTEXT_VARIABLES = [
  "selection",
  "sentence",
  "paragraphs",
  "targetLanguage",
  "webTitle",
  "webUrl",
  "webContent",
] as const satisfies readonly (keyof PromptContext)[];

export type RenderedLlmQuery = {
  readonly fields: readonly LlmCompletionField[];
  readonly failures: readonly QueryFieldResult[];
  readonly referencedVariables: readonly PromptContextVariable[];
};

const VARIABLE_PATTERN = /{{\s*([A-Za-z][A-Za-z0-9]*)\s*}}/g;
const KNOWN_VARIABLES = new Set<string>(PROMPT_CONTEXT_VARIABLES);

function instructionVariables(instruction: string) {
  const variables = Array.from(instruction.matchAll(VARIABLE_PATTERN), (match) => match[1] ?? "");
  return {
    known: variables.filter((variable): variable is PromptContextVariable => (
      KNOWN_VARIABLES.has(variable)
    )),
    unknown: [...new Set(variables.filter((variable) => !KNOWN_VARIABLES.has(variable)))],
  };
}

export function analyzeLlmPromptFields(
  fields: readonly LlmQuerySchemaField[],
): PromptTemplateAnalysis {
  const referenced = new Set<PromptContextVariable>();
  const warnings: PromptTemplateAnalysis["warnings"][number][] = [];

  for (const field of fields) {
    const variables = instructionVariables(field.instruction);
    variables.known.forEach((variable) => referenced.add(variable));
    if (variables.unknown.length > 0) {
      warnings.push({
        fieldId: field.id,
        fieldLabel: field.label,
        unknownVariables: variables.unknown,
      });
    }
  }

  return {
    referencedVariables: PROMPT_CONTEXT_VARIABLES.filter((variable) => referenced.has(variable)),
    warnings,
  };
}

export function renderLlmQueryFields(
  fields: readonly LlmQuerySchemaField[],
  context: PromptContext,
): RenderedLlmQuery {
  const boundedContext: PromptContext = {
    ...context,
    webContent: context.webContent.slice(0, 2000),
  };
  const renderedFields: LlmCompletionField[] = [];
  const failures: QueryFieldResult[] = [];
  const referenced = new Set<PromptContextVariable>();

  for (const field of fields) {
    const variables = instructionVariables(field.instruction);
    if (variables.unknown.length > 0) {
      const variable = variables.unknown[0] ?? "";
      failures.push({
        fieldId: field.id,
        status: "failed",
        error: {
          code: "unknown-prompt-variable",
          message: `Unknown prompt variable: ${variable}`,
        },
      });
      continue;
    }

    const instruction = field.instruction.replace(
      VARIABLE_PATTERN,
      (_match, variable: PromptContextVariable) => {
        referenced.add(variable);
        return boundedContext[variable];
      },
    );
    renderedFields.push({ id: field.id, type: field.type, instruction });
  }

  return {
    fields: renderedFields,
    failures,
    referencedVariables: PROMPT_CONTEXT_VARIABLES.filter((variable) => referenced.has(variable)),
  };
}
