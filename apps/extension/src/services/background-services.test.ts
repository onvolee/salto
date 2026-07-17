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
    { id: "second", label: "Second", source: "llm", type: "list", instruction: "Use {{selection}} with {{pageText}}.", order: 1, enabled: true },
    { id: "first", label: "First", source: "llm", type: "text", instruction: "Use {{targetLanguage}}.", order: 0, enabled: true },
    { id: "disabled", label: "Disabled", source: "llm", type: "text", instruction: "", order: 2, enabled: false }
  ]
};

const translateRequest = {
  type: "translate-selection" as const,
  payload: { requestId: "request-1", context },
};

function createServices() {
  const saveVocabulary = {
    save: vi.fn().mockResolvedValue({ status: "saved", vocabularyItemId: "item-1" })
  };
  const enrichmentQueue = { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() };
  const highlightTerms = { list: vi.fn().mockResolvedValue({ terms: ["unfamiliar"], paths: [] }) };
  const settings = {
    ensureDefaults: vi.fn(),
    getActive: vi.fn().mockResolvedValue({
      settings: { activeQueryTemplateId: template.id, targetLanguage: "zh-CN", highlightEnabled: true, themeMode: "system" },
      template
    })
  };
  return {
    services: createBackgroundServices({
      repositories: { settings, highlightTerms } as never,
      saveVocabulary: saveVocabulary as never,
      enrichmentQueue: enrichmentQueue as never,
      queryExecutor: createFakeQueryExecutor()
    }),
    saveVocabulary,
    enrichmentQueue,
    settings
  };
}

describe("background message boundary", () => {
  it("translates valid input and preserves enabled template order", async () => {
    const { services } = createServices();

    await expect(services.handleMessage(translateRequest)).resolves.toEqual({
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
        settings,
        highlightTerms: { list: vi.fn() }
      } as never,
      saveVocabulary: { save: vi.fn() } as never,
      enrichmentQueue: { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() } as never,
      queryExecutor: {
        execute: vi.fn().mockResolvedValue([
          { fieldId: "first", status: "ready", type: "text", value: ["wrong runtime value"] },
        ])
      }
    });

    const response = await services.handleMessage(translateRequest);

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
        saveVocabulary: { save: vi.fn() } as never,
        settings,
        highlightTerms: { list: vi.fn() }
      } as never,
      saveVocabulary: { save: vi.fn() } as never,
      enrichmentQueue: { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() } as never,
      queryExecutor: {
        execute: vi.fn().mockResolvedValue([
          { fieldId: "first", status: "ready", type: "text", value: "valid" },
          { fieldId: "second", status: "ready", type: "list", value: ["valid"] },
          { fieldId: "extra", status: "ready", type: "text", value: "not in template" }
        ])
      }
    });

    const response = await services.handleMessage(translateRequest);

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
        saveVocabulary: { save: vi.fn() } as never,
        settings,
        highlightTerms: { list: vi.fn() }
      } as never,
      saveVocabulary: { save: vi.fn() } as never,
      enrichmentQueue: { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() } as never,
      queryExecutor: {
        execute: vi.fn().mockResolvedValue([
          { fieldId: "first", status: "ready", type: "text", value: "first value" },
          { fieldId: "first", status: "ready", type: "text", value: "duplicate value" },
          { fieldId: "second", status: "ready", type: "list", value: ["valid sibling"] }
        ])
      }
    });

    const response = await services.handleMessage(translateRequest);

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
        saveVocabulary: { save: vi.fn() } as never,
        settings,
        highlightTerms: { list: vi.fn() }
      } as never,
      saveVocabulary: { save: vi.fn() } as never,
      enrichmentQueue: { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() } as never,
      queryExecutor: { execute: vi.fn().mockResolvedValue([malformed]) }
    });

    const response = await services.handleMessage(translateRequest);

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
    const { services, saveVocabulary } = createServices();
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
      data: { terms: ["unfamiliar"], paths: [] }
    });
    expect(saveVocabulary.save).toHaveBeenCalledWith(savePayload);
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
      data: { terms: [], paths: [] }
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

    const response = await services.handleMessage(translateRequest);

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
    ["malformed context", { type: "translate-selection", payload: { requestId: "bad", context: { selection: "x" } } }, "invalid-payload"],
    ["overlong term", { type: "save-vocabulary", payload: { term: "x".repeat(501), language: "en", context: {} } }, "invalid-payload"],
    ["blank term", { type: "save-vocabulary", payload: { term: "   ", language: "en", context: { sentence: "", paragraphs: "", pageTitle: "", pageUrl: "" } } }, "invalid-payload"]
  ])("rejects %s with a stable non-secret error", async (_name, message, code) => {
    const { services } = createServices();
    const response = await services.handleMessage(message);

    expect(response).toEqual({ ok: false, error: { code, message: expect.any(String) } });
    expect(JSON.stringify(response)).not.toContain("do-not-echo");
  });

  it("exposes public LLM state without serializing the API key", async () => {
    const { settings } = createServices();
    const llmSettings = {
      getPublicState: vi.fn().mockResolvedValue({
        config: {
          provider: "openai-compatible",
          baseUrl: "https://api.example.com/v1",
          model: "model-a",
        },
        hasApiKey: true,
      }),
    };
    const configured = createBackgroundServices({
      repositories: {
        llmSettings,
        settings,
      } as never,
      saveVocabulary: { save: vi.fn() } as never,
      enrichmentQueue: { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() } as never,
      queryExecutor: createFakeQueryExecutor(),
    });

    const response = await configured.handleMessage({ type: "get-llm-config" });

    expect(response).toEqual({
      ok: true,
      type: "get-llm-config",
      data: {
        config: {
          provider: "openai-compatible",
          baseUrl: "https://api.example.com/v1",
          model: "model-a",
        },
        hasApiKey: true,
        promptAnalysis: {
          referencedVariables: ["selection", "targetLanguage"],
          warnings: [{
            fieldId: "second",
            fieldLabel: "Second",
            unknownVariables: ["pageText"],
          }],
        },
      },
    });
    expect(JSON.stringify(response)).not.toContain("apiKey");
  });

  it("persists normalized LLM settings only for an authorized extension page", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const getPublicState = vi.fn().mockResolvedValue({
      config: {
        provider: "openai-compatible",
        baseUrl: "https://api.example.com/v1",
        model: "model-a",
      },
      hasApiKey: true,
    });
    const services = createBackgroundServices({
      repositories: { llmSettings: { save, getPublicState } } as never,
      saveVocabulary: { save: vi.fn() } as never,
      enrichmentQueue: { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() } as never,
      queryExecutor: createFakeQueryExecutor(),
      hasOriginPermission: vi.fn().mockResolvedValue(true),
    });
    const request = {
      type: "save-llm-config",
      payload: {
        config: {
          provider: "openai-compatible",
          baseUrl: "https://api.example.com/v1/",
          model: " model-a ",
        },
        apiKey: " secret-a ",
      },
    };

    await expect(services.handleMessage(request, { source: "content-script" })).resolves.toEqual({
      ok: false,
      error: {
        code: "forbidden",
        message: "This request is available only from extension settings",
      },
    });
    await expect(services.handleMessage(request, { source: "extension-page" })).resolves.toEqual({
      ok: true,
      type: "save-llm-config",
      data: await getPublicState(),
    });
    expect(save).toHaveBeenCalledWith({
      provider: "openai-compatible",
      baseUrl: "https://api.example.com/v1",
      model: "model-a",
    }, { apiKey: "secret-a" });
  });

  it("cancels the matching in-flight translation", async () => {
    const { settings } = createServices();
    let observedSignal: AbortSignal | undefined;
    const execute = vi.fn((_template, _context, signal?: AbortSignal) => {
      observedSignal = signal;
      return new Promise((resolve) => {
        signal?.addEventListener("abort", () => resolve([]), { once: true });
      });
    });
    const services = createBackgroundServices({
      repositories: {
        saveVocabulary: { save: vi.fn() } as never,
        settings,
        highlightTerms: { list: vi.fn() },
      } as never,
      saveVocabulary: { save: vi.fn() } as never,
      enrichmentQueue: { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() } as never,
      queryExecutor: { execute },
    });

    const translation = services.handleMessage(translateRequest);
    await vi.waitFor(() => expect(observedSignal).toBeDefined());

    await expect(services.handleMessage({
      type: "cancel-translation",
      payload: { requestId: "request-1" },
    })).resolves.toEqual({
      ok: true,
      type: "cancel-translation",
      data: { cancelled: true },
    });
    expect(observedSignal?.aborted).toBe(true);
    await translation;
  });
});
