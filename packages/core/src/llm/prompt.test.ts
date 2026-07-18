import { describe, expect, it } from "vitest";

import type { LlmQuerySchemaField, PromptContext } from "../query-template/types";
import {
  analyzeLlmPromptFields,
  parsePromptTemplate,
  renderLlmQueryFields,
} from "./prompt";

const context: PromptContext = {
  selection: "bank",
  sentence: "She sat on the river bank.",
  paragraphs: "Before. She sat on the river bank. After.",
  targetLanguage: "zh-CN",
  webTitle: "Reading fixture",
  webUrl: "https://example.com/read",
  webContent: "Article body",
};

function field(id: string, instruction: string): LlmQuerySchemaField {
  return {
    id,
    label: id,
    source: "llm",
    type: "text",
    instruction,
    order: 0,
    enabled: true,
  };
}

describe("renderLlmQueryFields", () => {
  it("parses compatible whitespace, repeated, and adjacent known variables", () => {
    expect(parsePromptTemplate("Before {{ selection }}{{selection}} after")).toEqual({
      tokens: [
        { kind: "text", value: "Before ", start: 0, end: 7 },
        { kind: "variable", name: "selection", raw: "{{ selection }}", start: 7, end: 22 },
        { kind: "variable", name: "selection", raw: "{{selection}}", start: 22, end: 35 },
        { kind: "text", value: " after", start: 35, end: 41 },
      ],
      diagnostics: [
        { kind: "known", variable: "selection", start: 7, end: 22 },
        { kind: "known", variable: "selection", start: 22, end: 35 },
      ],
    });
  });

  it("distinguishes unknown variables from known variables", () => {
    expect(parsePromptTemplate("Use {{ pageText }} near {{sentence}}.")).toEqual({
      tokens: [
        { kind: "text", value: "Use ", start: 0, end: 4 },
        { kind: "variable", name: "pageText", raw: "{{ pageText }}", start: 4, end: 18 },
        { kind: "text", value: " near ", start: 18, end: 24 },
        { kind: "variable", name: "sentence", raw: "{{sentence}}", start: 24, end: 36 },
        { kind: "text", value: ".", start: 36, end: 37 },
      ],
      diagnostics: [
        { kind: "unknown", variable: "pageText", start: 4, end: 18 },
        { kind: "known", variable: "sentence", start: 24, end: 36 },
      ],
    });
  });

  it("marks an empty variable token as malformed", () => {
    expect(parsePromptTemplate("A {{ }} B")).toEqual({
      tokens: [
        { kind: "text", value: "A ", start: 0, end: 2 },
        { kind: "malformed", raw: "{{ }}", reason: "empty-variable", start: 2, end: 7 },
        { kind: "text", value: " B", start: 7, end: 9 },
      ],
      diagnostics: [{
        kind: "malformed",
        raw: "{{ }}",
        reason: "empty-variable",
        start: 2,
        end: 7,
      }],
    });
  });

  it("marks invalid variable identifiers as malformed instead of unknown", () => {
    const result = parsePromptTemplate("{{1x}} {{foo-bar}} {{foo_bar}} {{foo bar}}");

    expect(result.tokens.filter((token) => token.kind === "malformed")).toEqual([
      { kind: "malformed", raw: "{{1x}}", reason: "invalid-identifier", start: 0, end: 6 },
      { kind: "malformed", raw: "{{foo-bar}}", reason: "invalid-identifier", start: 7, end: 18 },
      { kind: "malformed", raw: "{{foo_bar}}", reason: "invalid-identifier", start: 19, end: 30 },
      { kind: "malformed", raw: "{{foo bar}}", reason: "invalid-identifier", start: 31, end: 42 },
    ]);
    expect(result.diagnostics.every((diagnostic) => diagnostic.kind === "malformed"))
      .toBe(true);
  });

  it.each([
    ["before {{selection", "{{selection", "unmatched-opening-braces", 7, 18],
    ["before }} after", "}}", "unmatched-closing-braces", 7, 9],
    ["before { after", "{", "unmatched-opening-braces", 7, 8],
    ["before } after", "}", "unmatched-closing-braces", 7, 8],
  ] as const)("marks unmatched braces in %s as malformed", (template, raw, reason, start, end) => {
    expect(parsePromptTemplate(template).diagnostics).toContainEqual({
      kind: "malformed",
      raw,
      reason,
      start,
      end,
    });
  });

  it("marks triple-brace runs as malformed instead of parsing the nested name", () => {
    expect(parsePromptTemplate("{{{selection}}}").diagnostics).toEqual([
      {
        kind: "malformed",
        raw: "{{{",
        reason: "triple-brace-run",
        start: 0,
        end: 3,
      },
      {
        kind: "malformed",
        raw: "}}}",
        reason: "triple-brace-run",
        start: 12,
        end: 15,
      },
    ]);
  });

  it("does not consume part of a triple closing run as a valid token", () => {
    expect(parsePromptTemplate("{{selection}}}").diagnostics).toEqual([{
      kind: "malformed",
      raw: "{{selection}}}",
      reason: "triple-brace-run",
      start: 0,
      end: 14,
    }]);
  });

  it("reports referenced context and saved-template warnings", () => {
    const result = analyzeLlmPromptFields([
      field("valid", "Translate {{selection}} into {{targetLanguage}}."),
      field("warning", "Use {{pageText}} and {{pageText}} near {{sentence}}."),
    ]);

    expect(result).toEqual({
      referencedVariables: ["selection", "sentence", "targetLanguage"],
      warnings: [{
        fieldId: "warning",
        fieldLabel: "warning",
        unknownVariables: ["pageText"],
        malformedTokens: [],
      }],
    });
  });

  it("reports unknown and malformed prompt warnings separately", () => {
    expect(analyzeLlmPromptFields([
      field("warning", "Use {{pageText}}, {{ }}, and {{foo-bar}}."),
    ])).toEqual({
      referencedVariables: [],
      warnings: [{
        fieldId: "warning",
        fieldLabel: "warning",
        unknownVariables: ["pageText"],
        malformedTokens: [
          { raw: "{{ }}", reason: "empty-variable" },
          { raw: "{{foo-bar}}", reason: "invalid-identifier" },
        ],
      }],
    });
  });

  it("renders every supported variable and reports only referenced context", () => {
    const result = renderLlmQueryFields([
      field(
        "all",
        "{{selection}}|{{sentence}}|{{paragraphs}}|{{targetLanguage}}|{{webTitle}}|{{webUrl}}|{{webContent}}",
      ),
    ], context);

    expect(result.fields).toEqual([{
      id: "all",
      type: "text",
      instruction: [
        context.selection,
        context.sentence,
        context.paragraphs,
        context.targetLanguage,
        context.webTitle,
        context.webUrl,
        context.webContent,
      ].join("|"),
    }]);
    expect(result.referencedVariables).toEqual([
      "selection",
      "sentence",
      "paragraphs",
      "targetLanguage",
      "webTitle",
      "webUrl",
      "webContent",
    ]);
    expect(result.failures).toEqual([]);
  });

  it("does not expose unreferenced page context to the provider request", () => {
    const result = renderLlmQueryFields([
      field("translation", "Translate {{selection}} into {{targetLanguage}}."),
    ], context);

    expect(result.fields[0]?.instruction).toBe("Translate bank into zh-CN.");
    expect(result.referencedVariables).toEqual(["selection", "targetLanguage"]);
    expect(JSON.stringify(result.fields)).not.toContain(context.webContent);
    expect(JSON.stringify(result.fields)).not.toContain(context.webUrl);
  });

  it("bounds web content again before rendering", () => {
    const result = renderLlmQueryFields([
      field("content", "{{webContent}}"),
    ], { ...context, webContent: "x".repeat(2500) });

    expect(result.fields[0]?.instruction).toHaveLength(2000);
  });

  it.each([2000, 2001])("keeps webContent within 2000 UTF-16 code units at %i", (length) => {
    const result = renderLlmQueryFields([
      field("content", "{{webContent}}"),
    ], { ...context, webContent: "x".repeat(length) });

    expect(result.fields[0]?.instruction).toBe("x".repeat(Math.min(length, 2000)));
  });

  it("renders missing known context as an empty string without a warning or failure", () => {
    const fields = [field("optional", "Before {{ sentence }} after")];

    expect(analyzeLlmPromptFields(fields).warnings).toEqual([]);
    expect(renderLlmQueryFields(fields, { ...context, sentence: "" })).toEqual({
      fields: [{ id: "optional", type: "text", instruction: "Before  after" }],
      failures: [],
      referencedVariables: ["sentence"],
    });
  });

  it("isolates an unknown variable as a field failure", () => {
    const result = renderLlmQueryFields([
      field("valid", "Translate {{selection}}."),
      field("invalid", "Use {{pageText}}."),
    ], context);

    expect(result.fields).toEqual([{
      id: "valid",
      type: "text",
      instruction: "Translate bank.",
    }]);
    expect(result.failures).toEqual([{
      fieldId: "invalid",
      status: "failed",
      error: {
        code: "unknown-prompt-variable",
        message: "Unknown prompt variable: pageText",
      },
    }]);
  });

  it("isolates malformed syntax with a code distinct from unknown variables", () => {
    const result = renderLlmQueryFields([
      field("valid", "Translate {{selection}}."),
      field("malformed", "Use {{ }}."),
    ], context);

    expect(result.fields).toEqual([{
      id: "valid",
      type: "text",
      instruction: "Translate bank.",
    }]);
    expect(result.failures).toEqual([{
      fieldId: "malformed",
      status: "failed",
      error: {
        code: "malformed-prompt-variable",
        message: "Malformed prompt variable (empty-variable): {{ }}",
      },
    }]);
  });
});
