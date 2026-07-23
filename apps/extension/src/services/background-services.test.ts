import { describe, expect, it, vi } from "vitest";

import {
  DictionaryLookupError,
  type PromptContext,
  type QueryTemplate,
} from "@salto/core";

import { QueryTemplateRepositoryError } from "../repositories";
import { createOpenAiCompatibleQueryExecutor } from "../llm/openai-compatible-query-executor";
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

function llmField(
  id: string,
  label: string,
  type: "text" | "list",
  instruction: string,
  order: number,
  enabled = true,
): QueryTemplate["fields"][number] {
  return {
    id,
    definitionId: `definition:${id}`,
    content: { label, source: "llm", type, instruction },
    order,
    enabled,
  };
}

const template: QueryTemplate = {
  id: "system-default",
  name: "Default",
  createdAt: "2026-07-16T00:00:00.000Z",
  updatedAt: "2026-07-16T00:00:00.000Z",
  fields: [
    llmField("second", "Second", "list", "Use {{selection}} with {{pageText}}.", 1),
    llmField("first", "First", "text", "Use {{targetLanguage}}.", 0),
    llmField("disabled", "Disabled", "text", "This disabled field is reserved.", 2, false),
  ]
};

const translateRequest = {
  type: "translate-selection" as const,
  payload: { requestId: "request-1", context, template },
};

function createServices() {
  const saveVocabulary = {
    save: vi.fn().mockResolvedValue({ status: "saved", vocabularyItemId: "item-1" })
  };
  const enrichmentQueue = { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() };
  const highlightTerms = { list: vi.fn().mockResolvedValue({ terms: ["unfamiliar"], paths: [] }) };
  const settings = {
    ensureDefaults: vi.fn(),
    get: vi.fn().mockResolvedValue({
      activeQueryTemplateId: template.id,
      targetLanguage: "zh-CN",
      highlightEnabled: true,
      highlightSameWords: false,
      themeMode: "system",
      activeDictionaryProvider: "youdao-web",
      panelWidth: 360,
      panelHeight: 220,
    }),
    getActive: vi.fn().mockResolvedValue({
      settings: {
        activeQueryTemplateId: template.id,
        targetLanguage: "zh-CN",
        highlightEnabled: true,
        highlightSameWords: false,
        themeMode: "system",
        activeDictionaryProvider: "youdao-web",
        panelWidth: 360,
        panelHeight: 220,
      },
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
  it("runs the requested Youdao preview only for the settings page", async () => {
    const { settings } = createServices();
    const dictionaryAdapter = {
      capabilities: {
        providerId: "youdao-web" as const,
        supportedLanguages: ["en"],
        supportedFields: ["meaning" as const],
      },
      lookup: vi.fn().mockResolvedValue({
        providerId: "youdao-web",
        term: "example",
        language: "en",
        fields: {},
      }),
      preview: vi.fn().mockResolvedValue({
        term: "example",
        sections: [{ kind: "basic", entries: ["n. 示例"] }],
      }),
    };
    const services = createBackgroundServices({
      repositories: { settings } as never,
      saveVocabulary: { save: vi.fn() } as never,
      enrichmentQueue: { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() } as never,
      queryExecutor: createFakeQueryExecutor(),
      dictionaryAdapter,
    });

    await expect(services.handleMessage(
      { type: "test-dictionary-connection", payload: { term: "example" } },
      { source: "content-script" },
    )).resolves.toEqual({
      ok: false,
      error: {
        code: "forbidden",
        message: "This request is available only from extension settings",
      },
    });
    expect(dictionaryAdapter.preview).not.toHaveBeenCalled();

    await expect(services.handleMessage(
      { type: "test-dictionary-connection", payload: { term: "example" } },
      { source: "extension-page" },
    )).resolves.toEqual({
      ok: false,
      error: {
        code: "forbidden",
        message: "This request is available only from extension settings",
      },
    });
    expect(dictionaryAdapter.preview).not.toHaveBeenCalled();

    const response = await services.handleMessage(
      { type: "test-dictionary-connection", payload: { term: "example" } },
      { source: "options-page" },
    );

    expect(dictionaryAdapter.preview).toHaveBeenCalledOnce();
    expect(dictionaryAdapter.preview).toHaveBeenCalledWith(
      { term: "example", language: "en" },
      expect.any(AbortSignal),
    );
    expect(response).toEqual({
      ok: true,
      type: "test-dictionary-connection",
      data: {
        providerId: "youdao-web",
        preview: {
          term: "example",
          sections: [{ kind: "basic", entries: ["n. 示例"] }],
        },
      },
    });
    expect(JSON.stringify(response)).not.toContain("html");
  });

  it("accepts only a test term so the UI cannot choose a URL or translation source", async () => {
    const { services } = createServices();

    for (const request of [{
      type: "test-dictionary-connection",
      payload: {
        term: "private-term",
        url: "https://attacker.example/proxy",
      },
    }, {
      type: "test-dictionary-connection",
      payload: {
        term: "private-term",
        providerId: "cambridge-web",
      },
    }]) {
      await expect(services.handleMessage(
        request,
        { source: "options-page" },
      )).resolves.toEqual({
        ok: false,
        error: {
          code: "invalid-payload",
          message: "Invalid extension message payload",
        },
      });
    }
  });

  it("maps dictionary failures without returning provider content", async () => {
    const { settings } = createServices();
    const dictionaryAdapter = {
      capabilities: {
        providerId: "youdao-web" as const,
        supportedLanguages: ["en"],
        supportedFields: ["meaning" as const],
      },
      lookup: vi.fn().mockRejectedValue(new DictionaryLookupError("provider-error")),
      preview: vi.fn().mockRejectedValue(new DictionaryLookupError("provider-error")),
    };
    const services = createBackgroundServices({
      repositories: { settings } as never,
      saveVocabulary: { save: vi.fn() } as never,
      enrichmentQueue: { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() } as never,
      queryExecutor: createFakeQueryExecutor(),
      dictionaryAdapter,
    });

    const response = await services.handleMessage(
      { type: "test-dictionary-connection", payload: { term: "example" } },
      { source: "options-page" },
    );

    expect(response).toEqual({
      ok: false,
      error: {
        code: "provider",
        message: "The dictionary provider request failed",
      },
    });
    expect(JSON.stringify(response)).not.toContain("html");
  });

  it("maps missing entries and parser failures to distinct safe preview errors", async () => {
    const { settings } = createServices();
    const dictionaryAdapter = {
      capabilities: {
        providerId: "youdao-web" as const,
        supportedLanguages: ["en"],
        supportedFields: ["meaning" as const],
      },
      lookup: vi.fn(),
      preview: vi.fn()
        .mockRejectedValueOnce(new DictionaryLookupError("not-found"))
        .mockRejectedValueOnce(new DictionaryLookupError("parser-failure")),
    };
    const services = createBackgroundServices({
      repositories: { settings } as never,
      saveVocabulary: { save: vi.fn() } as never,
      enrichmentQueue: { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() } as never,
      queryExecutor: createFakeQueryExecutor(),
      dictionaryAdapter,
    });

    await expect(services.handleMessage(
      { type: "test-dictionary-connection", payload: { term: "missing" } },
      { source: "options-page" },
    )).resolves.toEqual({
      ok: false,
      error: { code: "not-found", message: "The dictionary entry was not found" },
    });
    await expect(services.handleMessage(
      { type: "test-dictionary-connection", payload: { term: "changed" } },
      { source: "options-page" },
    )).resolves.toEqual({
      ok: false,
      error: { code: "parser-failure", message: "The dictionary response could not be parsed" },
    });
  });

  it("refuses a connection test when the registered adapter is not Youdao", async () => {
    const { settings } = createServices();
    const dictionaryAdapter = {
      capabilities: {
        providerId: "cambridge-web" as const,
        supportedLanguages: ["en"],
        supportedFields: ["meaning" as const],
      },
      lookup: vi.fn(),
      preview: vi.fn(),
    };
    const services = createBackgroundServices({
      repositories: { settings } as never,
      saveVocabulary: { save: vi.fn() } as never,
      enrichmentQueue: { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() } as never,
      queryExecutor: createFakeQueryExecutor(),
      dictionaryAdapter,
    });

    await expect(services.handleMessage(
      { type: "test-dictionary-connection", payload: { term: "example" } },
      { source: "options-page" },
    )).resolves.toEqual({
      ok: false,
      error: {
        code: "not-configured",
        message: "The Youdao dictionary adapter is not registered",
      },
    });
    expect(dictionaryAdapter.lookup).not.toHaveBeenCalled();
  });

  it("returns one active-template snapshot with a non-secret recovery diagnostic", async () => {
    const storedTemplate = {
      ...template,
      apiKey: "must-not-reach-content",
      fields: template.fields.map((field) => ({
        ...field,
        secretMetadata: "must-not-reach-content",
      })),
    } as QueryTemplate;
    const recovered = {
      settings: {
        activeQueryTemplateId: "system-default",
        targetLanguage: "zh-CN",
        highlightEnabled: true,
        highlightSameWords: false,
        themeMode: "system" as const,
        activeDictionaryProvider: "youdao-web" as const,
        panelWidth: 360,
        panelHeight: 220,
      },
      template: storedTemplate,
      resolution: {
        status: "recovered" as const,
        code: "active-template-unavailable" as const,
      },
    };
    const settings = { getActive: vi.fn().mockResolvedValue(recovered) };
    const services = createBackgroundServices({
      repositories: { settings } as never,
      saveVocabulary: { save: vi.fn() } as never,
      enrichmentQueue: { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() } as never,
      queryExecutor: createFakeQueryExecutor(),
    });

    const response = await services.handleMessage(
      { type: "get-active-query-template" },
      { source: "content-script" },
    );

    expect(response).toEqual({
      ok: true,
      type: "get-active-query-template",
      data: { template, resolution: recovered.resolution },
    });
    expect(JSON.stringify(response)).not.toContain("must-not-reach-content");
  });

  it("executes the validated template snapshot supplied by the panel", async () => {
    const snapshot = {
      ...template,
      id: "reading-snapshot",
      name: "Reading snapshot",
    };
    const queryExecutor = {
      execute: vi.fn().mockResolvedValue([
        { fieldId: "first", status: "ready", type: "text", value: "snapshot value" },
        { fieldId: "second", status: "ready", type: "list", value: ["snapshot item"] },
      ]),
    };
    const settings = {
      get: vi.fn().mockResolvedValue({
        activeQueryTemplateId: "different-template",
        targetLanguage: "ja-JP",
        highlightEnabled: true,
        highlightSameWords: false,
        themeMode: "system",
        activeDictionaryProvider: "youdao-web",
        panelWidth: 360,
        panelHeight: 220,
      }),
    };
    const services = createBackgroundServices({
      repositories: { settings } as never,
      saveVocabulary: { save: vi.fn() } as never,
      enrichmentQueue: { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() } as never,
      queryExecutor,
    });

    await expect(services.handleMessage({
      type: "translate-selection",
      payload: { requestId: "snapshot-request", context, template: snapshot },
    })).resolves.toMatchObject({
      ok: true,
      type: "translate-selection",
      data: { templateId: "reading-snapshot", templateName: "Reading snapshot" },
    });
    expect(queryExecutor.execute).toHaveBeenCalledWith(
      snapshot,
      { ...context, targetLanguage: "ja-JP" },
      expect.any(AbortSignal),
      expect.any(Function),
    );
  });

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
      data: { enabled: true, terms: ["unfamiliar"], paths: [] }
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
        highlightSameWords: false,
        themeMode: "system",
        activeDictionaryProvider: "youdao-web",
        panelWidth: 360,
        panelHeight: 220,
      },
      template
    });

    await expect(services.handleMessage({ type: "list-highlight-terms" })).resolves.toEqual({
      ok: true,
      type: "list-highlight-terms",
      data: { enabled: false, terms: [], paths: [] }
    });
  });

  it("uses the background-owned target language", async () => {
    const { services, settings } = createServices();
    settings.get.mockResolvedValue({
      activeQueryTemplateId: template.id,
      targetLanguage: "ja-JP",
      highlightEnabled: true,
      highlightSameWords: false,
      themeMode: "system",
      activeDictionaryProvider: "youdao-web",
      panelWidth: 360,
      panelHeight: 220,
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

  it("uses a saved editor instruction with the shared rendering rules on the next translation", async () => {
    let storedTemplate: QueryTemplate = {
      id: "user-template",
      name: "Reading",
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
      fields: [llmField("runtime-field", "Runtime", "text", "Old instruction", 0)],
    };
    const templates = {
      update: vi.fn(async (next: QueryTemplate) => {
        storedTemplate = next;
        return next;
      }),
    };
    const settings = {
      get: vi.fn(async () => ({
        activeQueryTemplateId: storedTemplate.id,
        targetLanguage: "ja-JP",
        highlightEnabled: true,
        themeMode: "system" as const,
        activeDictionaryProvider: "youdao-web" as const,
      })),
      getActive: vi.fn(async () => ({
        settings: {
          activeQueryTemplateId: storedTemplate.id,
          targetLanguage: "ja-JP",
          highlightEnabled: true,
          themeMode: "system" as const,
        },
        template: storedTemplate,
      })),
    };
    const complete = vi.fn().mockResolvedValue({ "runtime-field": "translated" });
    const queryExecutor = createOpenAiCompatibleQueryExecutor({
      llmSettings: {
        getCredentials: vi.fn().mockResolvedValue({
          config: {
            provider: "openai-compatible",
            baseUrl: "https://api.example.com/v1",
            model: "model-a",
          },
          secret: { apiKey: "secret-a" },
        }),
      },
      createClient: vi.fn().mockReturnValue({ complete, testConnection: vi.fn() }),
      hasOriginPermission: vi.fn().mockResolvedValue(true),
    });
    const services = createBackgroundServices({
      repositories: { templates, settings } as never,
      saveVocabulary: { save: vi.fn() } as never,
      enrichmentQueue: { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() } as never,
      queryExecutor,
    });
    const savedTemplate: QueryTemplate = {
      ...storedTemplate,
      fields: [llmField(
        "runtime-field",
        "Runtime",
        "text",
        "Translate {{ selection }} to {{targetLanguage}}; context={{sentence}}.",
        0,
      )],
    };

    await expect(services.handleMessage({
      type: "update-query-template",
      payload: { template: savedTemplate },
    }, { source: "extension-page" })).resolves.toMatchObject({
      ok: true,
      type: "update-query-template",
    });
    await expect(services.handleMessage({
      type: "translate-selection",
      payload: {
        requestId: "saved-template-runtime",
        context: { ...context, sentence: "" },
        template: savedTemplate,
      },
    })).resolves.toMatchObject({
      ok: true,
      type: "translate-selection",
      data: {
        fields: [{ fieldId: "runtime-field", status: "ready", value: "translated" }],
      },
    });
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      fields: [{
        id: "runtime-field",
        type: "text",
        instruction: "Translate unfamiliar to ja-JP; context=.",
      }],
    }));
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

  it.each([
    ["selection", 501],
    ["sentence", 1001],
    ["paragraphs", 2001],
    ["webTitle", 301],
    ["webUrl", 2049],
    ["webContent", 2001],
  ] as const)("rejects overlong %s before the translation client", async (key, length) => {
    const { settings } = createServices();
    const queryExecutor = { execute: vi.fn() };
    const services = createBackgroundServices({
      repositories: { settings } as never,
      saveVocabulary: { save: vi.fn() } as never,
      enrichmentQueue: { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() } as never,
      queryExecutor,
    });

    await expect(services.handleMessage({
      ...translateRequest,
      payload: {
        ...translateRequest.payload,
        context: { ...context, [key]: "x".repeat(length) },
      },
    }, { source: "content-script" })).resolves.toEqual({
      ok: false,
      error: { code: "invalid-payload", message: "Invalid extension message payload" },
    });
    expect(queryExecutor.execute).not.toHaveBeenCalled();
  });

  it.each([
    ["sentence", 1001],
    ["paragraphs", 2001],
    ["pageTitle", 301],
    ["pageUrl", 2049],
  ] as const)("rejects overlong saved context %s before persistence", async (key, length) => {
    const { services, saveVocabulary } = createServices();
    const payload = {
      term: "bank",
      language: "en",
      context: {
        sentence: "sentence",
        paragraphs: "paragraphs",
        pageTitle: "title",
        pageUrl: "https://example.com",
        [key]: "x".repeat(length),
      },
    };

    await expect(services.handleMessage(
      { type: "save-vocabulary", payload },
      { source: "content-script" },
    )).resolves.toEqual({
      ok: false,
      error: { code: "invalid-payload", message: "Invalid extension message payload" },
    });
    expect(saveVocabulary.save).not.toHaveBeenCalled();
  });

  it("keeps template management behind the extension-page boundary and validates payloads", async () => {
    const created = { ...template, id: "user-1", name: "User template" };
    const templates = {
      list: vi.fn().mockResolvedValue([template, created]),
      create: vi.fn().mockResolvedValue(created),
      copy: vi.fn().mockResolvedValue({ ...created, id: "user-2" }),
      update: vi.fn().mockResolvedValue(created),
      delete: vi.fn().mockResolvedValue(undefined)
    };
    const settings = {
      get: vi.fn().mockResolvedValue({
        activeQueryTemplateId: template.id,
        targetLanguage: "zh-CN",
        highlightEnabled: true,
        themeMode: "system"
      }),
      save: vi.fn().mockResolvedValue({
        activeQueryTemplateId: created.id,
        targetLanguage: "zh-CN",
        highlightEnabled: true,
        themeMode: "system"
      })
    };
    const queryExecutor = { execute: vi.fn() };
    const services = createBackgroundServices({
      repositories: { templates, settings } as never,
      saveVocabulary: { save: vi.fn() } as never,
      enrichmentQueue: { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() } as never,
      queryExecutor
    });
    const input = {
      name: "New template",
      fields: [{ ...template.fields[0], order: 0 }]
    };

    await expect(services.handleMessage({
      type: "create-query-template",
      payload: input
    }, { source: "content-script" })).resolves.toEqual({
      ok: false,
      error: { code: "forbidden", message: "This request is available only from extension settings" }
    });
    await expect(services.handleMessage({
      type: "create-query-template",
      payload: input
    }, { source: "extension-page" })).resolves.toEqual({
      ok: true,
      type: "create-query-template",
      data: created
    });
    expect(templates.create).toHaveBeenCalledWith(input);

    await expect(services.handleMessage({
      type: "update-query-template",
      payload: { template: created }
    }, { source: "extension-page" })).resolves.toEqual({
      ok: true,
      type: "update-query-template",
      data: created
    });
    expect(queryExecutor.execute).not.toHaveBeenCalled();

    await expect(services.handleMessage({
      type: "update-query-template",
      payload: { template: { id: "user-1", name: "missing-fields" } }
    }, { source: "extension-page" })).resolves.toEqual({
      ok: false,
      error: { code: "invalid-payload", message: "Invalid extension message payload" }
    });
  });

  it("manages template field definitions only through the extension-page boundary", async () => {
    const input = {
      label: "Meaning",
      description: "Dictionary meaning",
      source: "dictionary" as const,
      dictionaryField: "meaning" as const,
      type: "text" as const,
    };
    const definition = {
      ...input,
      id: "definition-1",
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
    };
    const fieldDefinitions = {
      list: vi.fn().mockResolvedValue([definition]),
      create: vi.fn().mockResolvedValue(definition),
      update: vi.fn().mockResolvedValue({ ...definition, label: "Edited" }),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const services = createBackgroundServices({
      repositories: { fieldDefinitions } as never,
      saveVocabulary: { save: vi.fn() } as never,
      enrichmentQueue: { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() } as never,
      queryExecutor: createFakeQueryExecutor(),
    });

    await expect(services.handleMessage(
      { type: "list-template-field-definitions" },
      { source: "content-script" },
    )).resolves.toMatchObject({ ok: false, error: { code: "forbidden" } });
    await expect(services.handleMessage(
      { type: "list-template-field-definitions" },
      { source: "extension-page" },
    )).resolves.toEqual({
      ok: true,
      type: "list-template-field-definitions",
      data: { definitions: [definition] },
    });
    await expect(services.handleMessage(
      { type: "create-template-field-definition", payload: input },
      { source: "extension-page" },
    )).resolves.toEqual({
      ok: true,
      type: "create-template-field-definition",
      data: definition,
    });
    await expect(services.handleMessage({
      type: "update-template-field-definition",
      payload: { definitionId: definition.id, input: { ...input, label: "Edited" } },
    }, { source: "extension-page" })).resolves.toMatchObject({
      ok: true,
      type: "update-template-field-definition",
      data: { label: "Edited" },
    });
    await expect(services.handleMessage({
      type: "delete-template-field-definition",
      payload: { definitionId: definition.id },
    }, { source: "extension-page" })).resolves.toEqual({
      ok: true,
      type: "delete-template-field-definition",
      data: { deletedDefinitionId: definition.id },
    });
  });

  it("returns stable template mutation failures", async () => {
    const templates = {
      create: vi.fn(),
      copy: vi.fn(),
      update: vi.fn().mockRejectedValue(new QueryTemplateRepositoryError(
        "template-protected",
        "The system template cannot be changed"
      )),
      delete: vi.fn().mockRejectedValue(new QueryTemplateRepositoryError(
        "template-not-found",
        "Query template was not found"
      ))
    };
    const services = createBackgroundServices({
      repositories: { templates } as never,
      saveVocabulary: { save: vi.fn() } as never,
      enrichmentQueue: { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() } as never,
      queryExecutor: createFakeQueryExecutor()
    });

    await expect(services.handleMessage({
      type: "create-query-template",
      payload: { name: "", fields: [] }
    }, { source: "extension-page" })).resolves.toEqual({
      ok: false,
      error: { code: "invalid-payload", message: "Invalid extension message payload" }
    });
    await expect(services.handleMessage({
      type: "copy-query-template",
      payload: { templateId: " " }
    }, { source: "extension-page" })).resolves.toEqual({
      ok: false,
      error: { code: "invalid-payload", message: "Invalid extension message payload" }
    });
    await expect(services.handleMessage({
      type: "delete-query-template",
      payload: { templateId: " " }
    }, { source: "extension-page" })).resolves.toEqual({
      ok: false,
      error: { code: "invalid-payload", message: "Invalid extension message payload" }
    });
    await expect(services.handleMessage({
      type: "update-query-template",
      payload: { template: { id: "system-default", name: "Default" } }
    }, { source: "extension-page" })).resolves.toEqual({
      ok: false,
      error: { code: "invalid-payload", message: "Invalid extension message payload" }
    });
    await expect(services.handleMessage({
      type: "update-query-template",
      payload: { template }
    }, { source: "extension-page" })).resolves.toEqual({
      ok: false,
      error: { code: "template-protected", message: "The system template cannot be changed" }
    });
    await expect(services.handleMessage({
      type: "delete-query-template",
      payload: { templateId: "missing" }
    }, { source: "extension-page" })).resolves.toEqual({
      ok: false,
      error: { code: "template-not-found", message: "Query template was not found" }
    });
  });

  it("notifies subscribers when deleting the persisted active template applies a fallback", async () => {
    const before = {
      activeQueryTemplateId: "user-template",
      targetLanguage: "zh-CN",
      highlightEnabled: true,
      highlightSameWords: false,
      themeMode: "system" as const,
      activeDictionaryProvider: "youdao-web" as const,
      panelWidth: 360,
      panelHeight: 220,
    };
    const after = { ...before, activeQueryTemplateId: "system-default" };
    const settings = {
      get: vi.fn().mockResolvedValue(after),
    };
    const templates = { delete: vi.fn().mockResolvedValue(undefined) };
    const notifySettingsChanged = vi.fn().mockResolvedValue(undefined);
    const services = createBackgroundServices({
      repositories: { settings, templates } as never,
      saveVocabulary: { save: vi.fn() } as never,
      enrichmentQueue: { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() } as never,
      queryExecutor: createFakeQueryExecutor(),
      notifySettingsChanged,
    });

    await expect(services.handleMessage({
      type: "delete-query-template",
      payload: { templateId: "user-template" },
    }, { source: "extension-page" })).resolves.toEqual({
      ok: true,
      type: "delete-query-template",
      data: {
        deletedTemplateId: "user-template",
        activeQueryTemplateId: "system-default",
      },
    });
    expect(notifySettingsChanged).toHaveBeenCalledWith(after);
  });

  it("reads and writes extension settings and returns active template state", async () => {
    const savedSettings = {
      activeQueryTemplateId: "user-1",
      targetLanguage: "ja-JP",
      highlightEnabled: false,
      highlightSameWords: false,
      themeMode: "dark" as const,
      activeDictionaryProvider: "youdao-web" as const,
      panelWidth: 360,
      panelHeight: 220,
    };
    const settings = {
      get: vi.fn().mockResolvedValue({
        activeQueryTemplateId: template.id,
        targetLanguage: "zh-CN",
        highlightEnabled: true,
        highlightSameWords: false,
        themeMode: "system",
        activeDictionaryProvider: "youdao-web",
        panelWidth: 360,
        panelHeight: 220,
      }),
      save: vi.fn().mockResolvedValue(savedSettings)
    };
    const templates = { list: vi.fn().mockResolvedValue([template]), setDefault: vi.fn() };
    const prepareSettings = vi.fn().mockResolvedValue(undefined);
    const notifySettingsChanged = vi.fn().mockRejectedValue(new Error("No receiver"));
    const services = createBackgroundServices({
      repositories: { settings, templates } as never,
      saveVocabulary: { save: vi.fn() } as never,
      enrichmentQueue: { wake: vi.fn(), recover: vi.fn(), retryFailed: vi.fn() } as never,
      queryExecutor: createFakeQueryExecutor(),
      prepareSettings,
      notifySettingsChanged
    });

    await expect(services.handleMessage({ type: "get-extension-settings" }, { source: "extension-page" }))
      .resolves.toEqual({
        ok: true,
        type: "get-extension-settings",
        data: await settings.get()
      });
    const nextSettings = savedSettings;
    await expect(services.handleMessage({
      type: "save-extension-settings",
      payload: nextSettings
    }, { source: "extension-page" })).resolves.toEqual({
      ok: true,
      type: "save-extension-settings",
      data: savedSettings
    });
    expect(settings.save).toHaveBeenCalledWith(nextSettings);
    expect(prepareSettings).toHaveBeenCalledTimes(2);
    expect(prepareSettings).toHaveBeenCalledBefore(settings.get);
    expect(notifySettingsChanged).toHaveBeenCalledWith(savedSettings);
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
            malformedTokens: [],
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
    }, { apiKey: "secret-a" }, "https://api.example.com/*");
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
