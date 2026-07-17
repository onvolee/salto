import { describe, expect, it, vi } from "vitest";

import type { EnrichmentBatchRequest } from "./types";
import { createLlmEnrichmentSource } from "./llm-enrichment-source";

const term = "unfamiliar";

function createRequest(): EnrichmentBatchRequest {
  return {
    vocabularyItemId: "item-1",
    term,
    language: "en",
    jobs: [{
      id: "item-1:examples:job",
      vocabularyItemId: "item-1",
      fieldKey: "examples",
      source: "llm",
      status: "queued",
      attempts: 0,
      nextRunAt: "2026-07-16T00:00:00.000Z"
    }]
  };
}

describe("LLM enrichment source", () => {
  it("reads credentials only through the background-owned repository", async () => {
    const getCredentials = vi.fn().mockResolvedValue({
      config: {
        provider: "openai-compatible" as const,
        baseUrl: "https://api.example.com/v1",
        model: "model-a"
      },
      secret: { apiKey: "secret-a" }
    });
    const createClient = vi.fn().mockReturnValue({
      async complete() {
        return { examples: ["One example.", "Two example."] };
      }
    });
    const hasOriginPermission = vi.fn().mockResolvedValue(true);
    const source = createLlmEnrichmentSource({
      llmSettings: { getCredentials },
      createClient,
      hasOriginPermission
    });

    const results = await source.executeBatch(createRequest());

    expect(getCredentials).toHaveBeenCalled();
    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "https://api.example.com/v1" }),
      { apiKey: "secret-a" }
    );
    expect(results).toEqual([{
      jobId: "item-1:examples:job",
      fieldKey: "examples",
      status: "ready",
      value: ["One example.", "Two example."]
    }]);
  });

  it("returns no results when credentials are missing", async () => {
    const getCredentials = vi.fn().mockResolvedValue(null);
    const source = createLlmEnrichmentSource({
      llmSettings: { getCredentials },
      createClient: vi.fn(),
      hasOriginPermission: vi.fn()
    });

    const results = await source.executeBatch(createRequest());

    expect(results).toHaveLength(0);
  });

  it("returns no results when origin permission is denied", async () => {
    const getCredentials = vi.fn().mockResolvedValue({
      config: {
        provider: "openai-compatible" as const,
        baseUrl: "https://api.example.com/v1",
        model: "model-a"
      },
      secret: { apiKey: "secret-a" }
    });
    const source = createLlmEnrichmentSource({
      llmSettings: { getCredentials },
      createClient: vi.fn(),
      hasOriginPermission: vi.fn().mockResolvedValue(false)
    });

    const results = await source.executeBatch(createRequest());

    expect(results).toHaveLength(0);
  });
});
