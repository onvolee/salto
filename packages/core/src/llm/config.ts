import type { LlmPublicConfig } from "./types";

export type LlmConfigErrorCode =
  | "credential-bearing"
  | "invalid-temperature"
  | "invalid-url"
  | "missing-model"
  | "unsupported-scheme";

export class LlmConfigError extends Error {
  constructor(
    readonly code: LlmConfigErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LlmConfigError";
  }
}

export type NormalizedLlmPublicConfig = {
  readonly config: LlmPublicConfig;
  readonly origin: string;
  readonly permissionOrigin: string;
};

type RuntimeUrl = {
  hash: string;
  readonly hostname: string;
  readonly origin: string;
  password: string;
  pathname: string;
  readonly protocol: string;
  search: string;
  username: string;
  toString(): string;
};

const RuntimeUrl = (globalThis as unknown as {
  readonly URL: new (input: string) => RuntimeUrl;
}).URL;

export function normalizeLlmPublicConfig(
  value: LlmPublicConfig,
): NormalizedLlmPublicConfig {
  const model = value.model.trim();
  if (!model) {
    throw new LlmConfigError("missing-model", "Model is required");
  }
  if (
    value.temperature !== undefined
    && (!Number.isFinite(value.temperature) || value.temperature < 0 || value.temperature > 2)
  ) {
    throw new LlmConfigError(
      "invalid-temperature",
      "Temperature must be between 0 and 2",
    );
  }

  let url: RuntimeUrl;
  try {
    url = new RuntimeUrl(value.baseUrl.trim());
  } catch {
    throw new LlmConfigError("invalid-url", "Enter a valid API URL");
  }

  if (url.username || url.password) {
    throw new LlmConfigError(
      "credential-bearing",
      "API URLs cannot contain credentials",
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new LlmConfigError(
      "unsupported-scheme",
      "API URLs must use HTTP or HTTPS",
    );
  }
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  const baseUrl = url.toString().replace(/\/$/, "");
  const config: LlmPublicConfig = {
    provider: "openai-compatible",
    baseUrl,
    model,
    ...(value.temperature === undefined ? {} : { temperature: value.temperature }),
    ...(value.enableThinking === undefined ? {} : { enableThinking: value.enableThinking }),
  };

  return {
    config,
    origin: url.origin,
    permissionOrigin: `${url.origin}/*`,
  };
}
