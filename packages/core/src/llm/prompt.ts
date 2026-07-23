import type {
  LlmQuerySchemaField,
  PromptContext,
  QueryFieldResult,
} from "../query-template/types";
import { normalizePromptContext } from "../context-boundaries";
import type { LlmCompletionField } from "./types";
import type {
  PromptContextVariable,
  PromptMalformedReason,
  PromptTemplateAnalysis,
  PromptTemplateDiagnostic,
  PromptTemplateParseResult,
  PromptTemplateToken,
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

const VARIABLE_IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;
const KNOWN_VARIABLES = new Set<string>(PROMPT_CONTEXT_VARIABLES);

export function parsePromptTemplate(template: string): PromptTemplateParseResult {
  const tokens: PromptTemplateToken[] = [];
  const diagnostics: PromptTemplateDiagnostic[] = [];
  let cursor = 0;

  const pushText = (start: number, end: number) => {
    if (end > start) {
      tokens.push({ kind: "text", value: template.slice(start, end), start, end });
    }
  };
  const pushMalformed = (start: number, end: number, reason: PromptMalformedReason) => {
    const raw = template.slice(start, end);
    tokens.push({ kind: "malformed", raw, reason, start, end });
    diagnostics.push({ kind: "malformed", raw, reason, start, end });
  };

  while (cursor < template.length) {
    const nextOpening = template.indexOf("{", cursor);
    const nextClosing = template.indexOf("}", cursor);
    const braceStart = nextOpening < 0
      ? nextClosing
      : nextClosing < 0
        ? nextOpening
        : Math.min(nextOpening, nextClosing);
    if (braceStart < 0) {
      pushText(cursor, template.length);
      break;
    }
    pushText(cursor, braceStart);

    if (template[braceStart] === "}") {
      let end = braceStart + 1;
      while (template[end] === "}") end += 1;
      pushMalformed(
        braceStart,
        end,
        end - braceStart >= 3 ? "triple-brace-run" : "unmatched-closing-braces",
      );
      cursor = end;
      continue;
    }

    let openingEnd = braceStart + 1;
    while (template[openingEnd] === "{") openingEnd += 1;
    if (openingEnd - braceStart >= 3) {
      pushMalformed(braceStart, openingEnd, "triple-brace-run");
      cursor = openingEnd;
      continue;
    }

    if (template[braceStart + 1] !== "{") {
      pushMalformed(braceStart, braceStart + 1, "unmatched-opening-braces");
      cursor = braceStart + 1;
      continue;
    }

    const closingStart = template.indexOf("}}", braceStart + 2);
    if (closingStart < 0) {
      pushMalformed(braceStart, template.length, "unmatched-opening-braces");
      break;
    }

    let closingEnd = closingStart + 2;
    while (template[closingEnd] === "}") closingEnd += 1;
    if (closingEnd - closingStart >= 3) {
      pushMalformed(braceStart, closingEnd, "triple-brace-run");
      cursor = closingEnd;
      continue;
    }

    const end = closingStart + 2;
    const raw = template.slice(braceStart, end);
    const name = template.slice(braceStart + 2, closingStart).trim();
    if (!name) {
      pushMalformed(braceStart, end, "empty-variable");
    } else if (!VARIABLE_IDENTIFIER_PATTERN.test(name)) {
      pushMalformed(braceStart, end, "invalid-identifier");
    } else {
      tokens.push({ kind: "variable", name, raw, start: braceStart, end });
      diagnostics.push(KNOWN_VARIABLES.has(name)
        ? { kind: "known", variable: name as PromptContextVariable, start: braceStart, end }
        : { kind: "unknown", variable: name, start: braceStart, end });
    }
    cursor = end;
  }

  return { tokens, diagnostics };
}

function instructionVariables(instruction: string) {
  const diagnostics = parsePromptTemplate(instruction).diagnostics;
  const known = diagnostics
    .filter((diagnostic) => diagnostic.kind === "known")
    .map(({ variable }) => variable);
  const unknown = [...new Set(diagnostics
    .filter((diagnostic) => diagnostic.kind === "unknown")
    .map(({ variable }) => variable))];
  const malformed = diagnostics
    .filter((diagnostic) => diagnostic.kind === "malformed")
    .map(({ raw, reason }) => ({ raw, reason }));
  return {
    known,
    unknown,
    malformed,
  };
}

export function analyzeLlmPromptFields(
  fields: readonly LlmQuerySchemaField[],
): PromptTemplateAnalysis {
  const referenced = new Set<PromptContextVariable>();
  const warnings: PromptTemplateAnalysis["warnings"][number][] = [];

  for (const field of fields) {
    const variables = instructionVariables(field.content.instruction);
    variables.known.forEach((variable) => referenced.add(variable));
    if (variables.unknown.length > 0 || variables.malformed.length > 0) {
      warnings.push({
        fieldId: field.id,
        fieldLabel: field.content.label,
        unknownVariables: variables.unknown,
        malformedTokens: variables.malformed,
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
  const boundedContext = normalizePromptContext(context);
  const renderedFields: LlmCompletionField[] = [];
  const failures: QueryFieldResult[] = [];
  const referenced = new Set<PromptContextVariable>();

  for (const field of fields) {
    const parsed = parsePromptTemplate(field.content.instruction);
    const blockingDiagnostic = parsed.diagnostics.find(
      (diagnostic) => diagnostic.kind !== "known",
    );
    if (blockingDiagnostic?.kind === "unknown") {
      failures.push({
        fieldId: field.id,
        status: "failed",
        error: {
          code: "unknown-prompt-variable",
          message: `Unknown prompt variable: ${blockingDiagnostic.variable}`,
        },
      });
      continue;
    }
    if (blockingDiagnostic?.kind === "malformed") {
      failures.push({
        fieldId: field.id,
        status: "failed",
        error: {
          code: "malformed-prompt-variable",
          message: `Malformed prompt variable (${blockingDiagnostic.reason}): ${blockingDiagnostic.raw}`,
        },
      });
      continue;
    }

    const instruction = parsed.tokens.map((token) => {
      if (token.kind === "text") return token.value;
      if (token.kind === "malformed") return token.raw;
      const variable = token.name as PromptContextVariable;
      referenced.add(variable);
      return boundedContext[variable];
    }).join("");
    renderedFields.push({ id: field.id, type: field.content.type, instruction });
  }

  return {
    fields: renderedFields,
    failures,
    referencedVariables: PROMPT_CONTEXT_VARIABLES.filter((variable) => referenced.has(variable)),
  };
}
