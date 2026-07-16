import { describe, expect, it, vi } from "vitest";

import type { PromptContext, QueryTemplate } from "@salto/core";

import { createBackgroundServices } from "./background-services";
import { createFakeQueryExecutor } from "./fake-query-executor";

const context: PromptContext = {
  selection: "unfamiliar",
  sentence: "This word is unfamiliar.",
  paragraphs: "This word is unfamiliar to the reader.",
  targetLanguage: "zh-CN",
  webTitle: "Fixture",
  webUrl: "https://example.com/read",
  webContent: "This word is unfamiliar to the reader."
};

const template: QueryTemplate = {
  id: "system-default",
  name: "Default",
  createdAt: "2026-07-16T00:00:00.000Z",
  updatedAt: "2026-07-16T00:00:00.000Z",
  fields: [
    { id: "second", label: "Second", source: "llm", type: "list", instruction: "", order: 1, enabled: true },
    { id: "first", label: "First", source: "llm", type: "text", instruction: "", order: 0, enabled: true },
    { id: "disabled", label: "Disabled", source: "llm", type: "text", instruction: "", order: 2, enabled: false }
  ]
};

function createServices() {
  const vocabulary = {
    save: vi.fn().mockResolvedValue({ status: "saved", vocabularyItemId: "item-1" })
  };
  const highlightTerms = { list: vi.fn().mockResolvedValue(["unfamiliar"]) };
  const settings = {
    ensureDefaults: vi.fn(),
    getActive: vi.fn().mockResolvedValue({
      settings: { activeQueryTemplateId: template.id, targetLanguage: "zh-CN", highlightEnabled: true, themeMode: "system" },
      template
    })
  };
  return {
    services: createBackgroundServices({
      repositories: { vocabulary, settings, highlightTerms } as never,
      queryExecutor: createFakeQueryExecutor()
    }),
    vocabulary,
    settings
  };
}

describe("background message boundary", () => {
  it("translates valid input and preserves enabled template order", async () => {
    const { services } = createServices();

    await expect(services.handleMessage({ type: "translate-selection", payload: { context } })).resolves.toEqual({
      ok: true,
      type: "translate-selection",
      data: {
        templateId: "system-default",
        templateName: "Default",
        schema: [{ id: "first", label: "First" }, { id: "second", label: "Second" }],
        fields: [
          { fieldId: "first", status: "ready", type: "text", value: "Fake translation: unfamiliar -> zh-CN" },
          { fieldId: "second", status: "ready", type: "list", value: ["Fake key point 1: unfamiliar", "Fake key point 2: zh-CN"] }
        ]
      }
    });
  });

  it("converts malformed executor output into isolated field failures", async () => {
    const { settings } = createServices();
    const services = createBackgroundServices({
      repositories: {
        vocabulary: { save: vi.fn() },
        settings,
        highlightTerms: { list: vi.fn() }
      } as never,
        queryExecutor: {
        execute: vi.fn().mockResolvedValue([
          { fieldId: "first", status: "ready", type: "text", value: ["wrong runtime value"] },
        ])
      }
    });

    const response = await services.handleMessage({ type: "translate-selection", payload: { context } });

    expect(response.ok && response.type === "translate-selection" ? response.data.fields : []).toEqual([
      {
        fieldId: "first",
        status: "failed",
        error: { code: "invalid-field-result", message: "The provider returned an invalid field result" }
      },
      {
        fieldId: "second",
        status: "failed",
        error: { code: "missing-field-result", message: "The provider did not return this field" }
      }
    ]);
  });

  it("fails an unknown field without discarding valid active fields", async () => {
    const { settings } = createServices();
    const services = createBackgroundServices({
      repositories: {
        vocabulary: { save: vi.fn() },
        settings,
        highlightTerms: { list: vi.fn() }
      } as never,
      queryExecutor: {
        execute: vi.fn().mockResolvedValue([
          { fieldId: "first", status: "ready", type: "text", value: "valid" },
          { fieldId: "second", status: "ready", type: "list", value: ["valid"] },
          { fieldId: "extra", status: "ready", type: "text", value: "not in template" }
        ])
      }
    });

    const response = await services.handleMessage({ type: "translate-selection", payload: { context } });

    expect(response.ok && response.type === "translate-selection" ? response.data.fields : []).toEqual([
      {
        fieldId: "first",
        status: "ready",
        type: "text",
        value: "valid"
      },
      {
        fieldId: "second",
        status: "ready",
        type: "list",
        value: ["valid"]
      },
      {
        fieldId: "extra",
        status: "failed",
        error: { code: "unexpected-field-result", message: "The provider returned an unexpected field result" }
      }
    ]);
  });

  it("fails a duplicate field without discarding a valid sibling", async () => {
    const { settings } = createServices();
    const services = createBackgroundServices({
      repositories: {
        vocabulary: { save: vi.fn() },
        settings,
        highlightTerms: { list: vi.fn() }
      } as never,
      queryExecutor: {
        execute: vi.fn().mockResolvedValue([
          { fieldId: "first", status: "ready", type: "text", value: "first value" },
          { fieldId: "first", status: "ready", type: "text", value: "duplicate value" },
          { fieldId: "second", status: "ready", type: "list", value: ["valid sibling"] }
        ])
      }
    });

    const response = await services.handleMessage({ type: "translate-selection", payload: { context } });

    expect(response.ok && response.type === "translate-selection" ? response.data.fields : []).toEqual([
      {
        fieldId: "first",
        status: "failed",
        error: { code: "duplicate-field-result", message: "The provider returned this field more than once" }
      },
      { fieldId: "second", status: "ready", type: "list", value: ["valid sibling"] }
    ]);
  });

  it.each([
    { fieldId: "first", status: "unavailable", reason: "unknown" },
    { fieldId: "first", status: "failed", error: { code: 500, message: "bad" } },
    { fieldId: "first", status: "ready", type: "text", value: "" },
    { fieldId: "first", status: "ready", type: "list", value: [] }
  ])("rejects malformed result variants at the boundary", async (malformed) => {
    const { settings } = createServices();
    const services = createBackgroundServices({
      repositories: {
        vocabulary: { save: vi.fn() },
        settings,
        highlightTerms: { list: vi.fn() }
      } as never,
      queryExecutor: { execute: vi.fn().mockResolvedValue([malformed]) }
    });

    const response = await services.handleMessage({ type: "translate-selection", payload: { context } });

    expect(response.ok && response.type === "translate-selection" ? response.data.fields[0] : null)
      .toEqual({
        fieldId: "first",
        status: "failed",
        error: {
          code: "invalid-field-result",
          message: "The provider returned an invalid field result"
        }
      });
  });

  it("saves and lists terms through repositories", async () => {
    const { services, vocabulary } = createServices();
    const savePayload = {
      term: "unfamiliar",
      language: "en" as const,
      context: { sentence: context.sentence, paragraphs: context.paragraphs, pageTitle: context.webTitle, pageUrl: context.webUrl }
    };

    await expect(services.handleMessage({ type: "save-vocabulary", payload: savePayload })).resolves.toEqual({
      ok: true,
      type: "save-vocabulary",
      data: { status: "saved", vocabularyItemId: "item-1" }
    });
    await expect(services.handleMessage({ type: "list-highlight-terms" })).resolves.toEqual({
      ok: true,
      type: "list-highlight-terms",
      data: { terms: ["unfamiliar"] }
    });
    expect(vocabulary.save).toHaveBeenCalledWith(savePayload);
  });

  it("returns no highlight terms when highlighting is disabled", async () => {
    const { services, settings } = createServices();
    settings.getActive.mockResolvedValue({
      settings: {
        activeQueryTemplateId: template.id,
        targetLanguage: "zh-CN",
        highlightEnabled: false,
        themeMode: "system"
      },
      template
    });

    await expect(services.handleMessage({ type: "list-highlight-terms" })).resolves.toEqual({
      ok: true,
      type: "list-highlight-terms",
      data: { terms: [] }
    });
  });

  it("uses the background-owned target language", async () => {
    const { services, settings } = createServices();
    settings.getActive.mockResolvedValue({
      settings: {
        activeQueryTemplateId: template.id,
        targetLanguage: "ja-JP",
        highlightEnabled: true,
        themeMode: "system"
      },
      template
    });

    const response = await services.handleMessage({ type: "translate-selection", payload: { context } });

    expect(response.ok && response.type === "translate-selection" ? response.data.fields[0] : null)
      .toEqual({
        fieldId: "first",
        status: "ready",
        type: "text",
        value: "Fake translation: unfamiliar -> ja-JP"
      });
  });

  it.each([
    ["unknown request", { type: "read-api-key", payload: { secret: "do-not-echo" } }, "unknown-message"],
    ["malformed context", { type: "translate-selection", payload: { context: { selection: "x" } } }, "invalid-payload"],
    ["overlong term", { type: "save-vocabulary", payload: { term: "x".repeat(501), language: "en", context: {} } }, "invalid-payload"],
    ["blank term", { type: "save-vocabulary", payload: { term: "   ", language: "en", context: { sentence: "", paragraphs: "", pageTitle: "", pageUrl: "" } } }, "invalid-payload"]
  ])("rejects %s with a stable non-secret error", async (_name, message, code) => {
    const { services } = createServices();
    const response = await services.handleMessage(message);

    expect(response).toEqual({ ok: false, error: { code, message: expect.any(String) } });
    expect(JSON.stringify(response)).not.toContain("do-not-echo");
  });
});
