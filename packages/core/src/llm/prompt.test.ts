import { describe, expect, it } from "vitest";

import type { LlmQuerySchemaField, PromptContext } from "../query-template/types";
import { analyzeLlmPromptFields, renderLlmQueryFields } from "./prompt";

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
});
