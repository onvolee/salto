import { describe, expect, it } from "vitest";

import {
  LlmConfigError,
  normalizeLlmPublicConfig,
  type LlmConfigErrorCode,
} from "./config";

function expectConfigError(run: () => unknown, code: LlmConfigErrorCode) {
  try {
    run();
    throw new Error("Expected configuration to be rejected");
  } catch (error) {
    expect(error).toBeInstanceOf(LlmConfigError);
    expect((error as LlmConfigError).code).toBe(code);
  }
}

describe("normalizeLlmPublicConfig", () => {
  it("normalizes an HTTPS base URL and derives an origin-scoped permission", () => {
    expect(normalizeLlmPublicConfig({
      provider: "openai-compatible",
      baseUrl: " HTTPS://API.Example.COM:443/v1/// ",
      model: "  gpt-4.1-mini  ",
      temperature: 0.2,
    })).toEqual({
      config: {
        provider: "openai-compatible",
        baseUrl: "https://api.example.com/v1",
        model: "gpt-4.1-mini",
        temperature: 0.2,
      },
      origin: "https://api.example.com",
      permissionOrigin: "https://api.example.com/*",
    });
  });

  it.each([
    ["http://api.example.com:8000/v1", "http://api.example.com:8000/*"],
    ["http://localhost:11434/v1", "http://localhost:11434/*"],
    ["http://127.0.0.1:8080/v1", "http://127.0.0.1:8080/*"],
    ["http://[::1]:3000/v1", "http://[::1]:3000/*"],
  ])("allows the HTTP host %s", (baseUrl, permissionOrigin) => {
    expect(normalizeLlmPublicConfig({
      provider: "openai-compatible",
      baseUrl,
      model: "local-model",
    }).permissionOrigin).toBe(permissionOrigin);
  });

  it.each([
    ["https://user:password@example.com/v1", "credential-bearing"],
    ["ftp://example.com/v1", "unsupported-scheme"],
    ["not a url", "invalid-url"],
  ] as const)("rejects %s with a stable code", (baseUrl, code) => {
    expectConfigError(() => normalizeLlmPublicConfig({
      provider: "openai-compatible",
      baseUrl,
      model: "model",
    }), code);
  });

  it("requires a model", () => {
    expectConfigError(() => normalizeLlmPublicConfig({
      provider: "openai-compatible",
      baseUrl: "https://example.com/v1",
      model: "",
    }), "missing-model");
  });

  it.each([-0.1, 2.1])("rejects temperature %s", (temperature) => {
    expectConfigError(() => normalizeLlmPublicConfig({
      provider: "openai-compatible",
      baseUrl: "https://example.com/v1",
      model: "model",
      temperature,
    }), "invalid-temperature");
  });
});
