import type {
  ExtensionErrorCode,
  ExtensionRequest,
  ExtensionResponse,
  LlmConfigState,
  LlmOptionsState,
  LlmPublicConfig,
} from "@salto/core";

export type OptionsLlmErrorCode = ExtensionErrorCode
  | "missing-api-key"
  | "unexpected-response";

export class OptionsLlmError extends Error {
  constructor(
    readonly code: OptionsLlmErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OptionsLlmError";
  }
}

export interface OptionsLlmClient {
  getConfig(): Promise<LlmOptionsState>;
  saveConfig(config: LlmPublicConfig, apiKey?: string): Promise<LlmConfigState>;
  testConnection(): Promise<void>;
}

async function send(request: ExtensionRequest): Promise<ExtensionResponse> {
  return browser.runtime.sendMessage(request) as Promise<ExtensionResponse>;
}

function unwrap<T extends ExtensionResponse & { readonly ok: true }>(
  response: ExtensionResponse,
  type: T["type"],
): Extract<T, { readonly type: T["type"] }>["data"] {
  if (!response.ok) {
    throw new OptionsLlmError(response.error.code, response.error.message);
  }
  if (response.type !== type) {
    throw new OptionsLlmError("unexpected-response", "The background returned an unexpected response");
  }
  return response.data as Extract<T, { readonly type: T["type"] }>["data"];
}

export const browserOptionsLlmClient: OptionsLlmClient = {
  async getConfig() {
    const response = await send({ type: "get-llm-config" });
    return unwrap(response, "get-llm-config") as LlmOptionsState;
  },
  async saveConfig(config, apiKey) {
    const response = await send({
      type: "save-llm-config",
      payload: { config, ...(apiKey ? { apiKey } : {}) },
    });
    return unwrap(response, "save-llm-config") as LlmConfigState;
  },
  async testConnection() {
    const response = await send({ type: "test-llm-connection" });
    unwrap(response, "test-llm-connection");
  },
};

export interface LlmPermissionClient {
  request(permissionOrigin: string): Promise<boolean>;
  remove(permissionOrigin: string): Promise<boolean>;
}

export const browserLlmPermissionClient: LlmPermissionClient = {
  request(permissionOrigin) {
    return browser.permissions.request({ origins: [permissionOrigin] });
  },
  remove(permissionOrigin) {
    return browser.permissions.remove({ origins: [permissionOrigin] });
  },
};
