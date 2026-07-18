import { describe, expect, it, vi } from "vitest";

import { createDefaultQueryTemplate, type PromptContext } from "@salto/core";

import type { LlmSettingsRepository } from "../repositories/local-repositories";
import type { OpenAiCompatibleClient } from "./openai-compatible-client";
import { createOpenAiCompatibleQueryExecutor } from "./openai-compatible-query-executor";

const context: PromptContext = {
  selection: "bank",
  sentence: "She sat on the bank.",
  paragraphs: "",
  targetLanguage: "zh-CN",
  webTitle: "",
  webUrl: "https://example.com",
  webContent: "private page text",
};

const credentials = {
  config: {
    provider: "openai-compatible" as const,
    baseUrl: "https://api.example.com/v1",
    model: "model-a",
  },
  secret: { apiKey: "secret-a" },
};

function createDependencies(overrides: {
  credentials?: typeof credentials | null;
  permissionGranted?: boolean;
  output?: unknown;
} = {}) {
  const getCredentials = vi.fn<LlmSettingsRepository["getCredentials"]>()
    .mockResolvedValue(overrides.credentials === undefined ? credentials : overrides.credentials);
  const complete = vi.fn<OpenAiCompatibleClient["complete"]>()
    .mockResolvedValue(overrides.output ?? {
      "system-default:translation": "河岸",
      "system-default:key-points": ["noun", "riverside"],
    });
  const testConnection = vi.fn<OpenAiCompatibleClient["testConnection"]>();
  const createClient = vi.fn(() => ({ complete, testConnection }));
  const hasOriginPermission = vi.fn().mockResolvedValue(overrides.permissionGranted ?? true);
  const executor = createOpenAiCompatibleQueryExecutor({
    llmSettings: { getCredentials } as Pick<LlmSettingsRepository, "getCredentials">,
    createClient,
    hasOriginPermission,
  });

  return { complete, createClient, executor, getCredentials, hasOriginPermission };
}

describe("OpenAI-compatible query executor", () => {
  it("makes one provider call for all enabled LLM fields", async () => {
    const { complete, executor, hasOriginPermission } = createDependencies();

    const result = await executor.execute(createDefaultQueryTemplate("2026-01-01T00:00:00.000Z"), context);

    expect(result).toEqual([
      {
        fieldId: "system-default:translation",
        status: "ready",
        type: "text",
        value: "河岸",
      },
      {
        fieldId: "system-default:key-points",
        status: "ready",
        type: "list",
        value: ["noun", "riverside"],
      },
    ]);
    expect(hasOriginPermission).toHaveBeenCalledWith("https://api.example.com/*");
    expect(complete).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      fields: [
        expect.objectContaining({ id: "system-default:translation", type: "text" }),
        expect.objectContaining({ id: "system-default:key-points", type: "list" }),
      ],
    }));
    expect(JSON.stringify(complete.mock.calls[0]?.[0].fields)).not.toContain(context.webContent);
  });

  it("returns unavailable fields without a provider call when not configured", async () => {
    const { complete, executor } = createDependencies({ credentials: null });

    await expect(executor.execute(
      createDefaultQueryTemplate("2026-01-01T00:00:00.000Z"),
      context,
    )).resolves.toEqual([
      { fieldId: "system-default:translation", status: "unavailable", reason: "not-configured" },
      { fieldId: "system-default:key-points", status: "unavailable", reason: "not-configured" },
    ]);
    expect(complete).not.toHaveBeenCalled();
  });

  it("blocks the provider call when the exact origin is not granted", async () => {
    const { complete, executor } = createDependencies({ permissionGranted: false });

    const result = await executor.execute(
      createDefaultQueryTemplate("2026-01-01T00:00:00.000Z"),
      context,
    );

    expect(result).toEqual([
      expect.objectContaining({
        fieldId: "system-default:translation",
        status: "failed",
        error: expect.objectContaining({ code: "permission-denied" }),
      }),
      expect.objectContaining({
        fieldId: "system-default:key-points",
        status: "failed",
        error: expect.objectContaining({ code: "permission-denied" }),
      }),
    ]);
    expect(complete).not.toHaveBeenCalled();
  });

  it("isolates missing, malformed, extra, and reordered fields", async () => {
    const { executor } = createDependencies({
      output: {
        "system-default:key-points": "wrong type",
        extra: "unexpected",
      },
    });

    const result = await executor.execute(
      createDefaultQueryTemplate("2026-01-01T00:00:00.000Z"),
      context,
    );

    expect(result).toEqual([
      expect.objectContaining({
        fieldId: "system-default:translation",
        status: "failed",
        error: expect.objectContaining({ code: "missing-field-result" }),
      }),
      expect.objectContaining({
        fieldId: "system-default:key-points",
        status: "failed",
        error: expect.objectContaining({ code: "invalid-field-result" }),
      }),
      expect.objectContaining({
        fieldId: "extra",
        status: "failed",
        error: expect.objectContaining({ code: "unexpected-field-result" }),
      }),
    ]);
  });

  it("accepts an empty list as a correctly typed field result", async () => {
    const { executor } = createDependencies({
      output: {
        "system-default:translation": "河岸",
        "system-default:key-points": [],
      },
    });

    const result = await executor.execute(
      createDefaultQueryTemplate("2026-01-01T00:00:00.000Z"),
      context,
    );

    expect(result[1]).toEqual({
      fieldId: "system-default:key-points",
      status: "ready",
      type: "list",
      value: [],
    });
  });

  it("passes the cancellation signal to the provider", async () => {
    const { complete, executor } = createDependencies();
    const controller = new AbortController();

    await executor.execute(
      createDefaultQueryTemplate("2026-01-01T00:00:00.000Z"),
      context,
      controller.signal,
    );

    expect(complete.mock.calls[0]?.[0].signal).toBe(controller.signal);
  });

  it("isolates unknown and malformed prompt fields with distinct stable codes", async () => {
    const { complete, executor } = createDependencies({
      output: { valid: "translated" },
    });
    const template = {
      ...createDefaultQueryTemplate("2026-01-01T00:00:00.000Z"),
      id: "prompt-diagnostics",
      fields: [
        { id: "valid", label: "Valid", source: "llm" as const, type: "text" as const, instruction: "Use {{selection}}.", order: 0, enabled: true },
        { id: "unknown", label: "Unknown", source: "llm" as const, type: "text" as const, instruction: "Use {{pageText}}.", order: 1, enabled: true },
        { id: "malformed", label: "Malformed", source: "llm" as const, type: "text" as const, instruction: "Use {{ }}.", order: 2, enabled: true },
      ],
    };

    const result = await executor.execute(template, context);

    expect(result).toEqual([
      { fieldId: "valid", status: "ready", type: "text", value: "translated" },
      {
        fieldId: "unknown",
        status: "failed",
        error: {
          code: "unknown-prompt-variable",
          message: "Unknown prompt variable: pageText",
        },
      },
      {
        fieldId: "malformed",
        status: "failed",
        error: {
          code: "malformed-prompt-variable",
          message: "Malformed prompt variable (empty-variable): {{ }}",
        },
      },
    ]);
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      fields: [{ id: "valid", type: "text", instruction: "Use bank." }],
    }));
  });
});
