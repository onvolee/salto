import type {
  ExtensionErrorCode,
  ExtensionRequest,
} from "@salto/core";

export const YOUDAO_PERMISSION_ORIGIN = "https://dict.youdao.com/*";

export type OptionsDictionaryErrorCode = ExtensionErrorCode
  | "unexpected-response";

export class OptionsDictionaryError extends Error {
  constructor(
    readonly code: OptionsDictionaryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OptionsDictionaryError";
  }
}

export interface OptionsDictionaryClient {
  testConnection(): Promise<void>;
}

export interface DictionaryPermissionClient {
  request(permissionOrigin: string): Promise<boolean>;
}

type DictionaryTestRequest = Extract<
  ExtensionRequest,
  { readonly type: "test-dictionary-connection" }
>;
type SendDictionaryMessage = (request: DictionaryTestRequest) => Promise<unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).toSorted();
  return actual.length === keys.length
    && keys.toSorted().every((key, index) => key === actual[index]);
}

function unwrapDictionaryTestResponse(response: unknown): void {
  if (!isRecord(response) || response.ok !== true) {
    if (
      isRecord(response)
      && response.ok === false
      && hasExactKeys(response, ["ok", "error"])
      && isRecord(response.error)
      && hasExactKeys(response.error, ["code", "message"])
      && typeof response.error.code === "string"
      && typeof response.error.message === "string"
    ) {
      throw new OptionsDictionaryError(
        response.error.code as ExtensionErrorCode,
        response.error.message,
      );
    }
    throw new OptionsDictionaryError(
      "unexpected-response",
      "The background returned an unexpected response",
    );
  }
  if (
    !hasExactKeys(response, ["ok", "type", "data"])
    || response.type !== "test-dictionary-connection"
    || !isRecord(response.data)
    || !hasExactKeys(response.data, ["connected", "providerId"])
    || response.data.connected !== true
    || response.data.providerId !== "youdao-web"
  ) {
    throw new OptionsDictionaryError(
      "unexpected-response",
      "The background returned an unexpected response",
    );
  }
}

export function createOptionsDictionaryClient(
  send: SendDictionaryMessage,
): OptionsDictionaryClient {
  return {
    async testConnection() {
      unwrapDictionaryTestResponse(await send({
        type: "test-dictionary-connection",
      }));
    },
  };
}

export const browserOptionsDictionaryClient = createOptionsDictionaryClient(
  (request) => browser.runtime.sendMessage(request),
);

export const browserDictionaryPermissionClient: DictionaryPermissionClient = {
  request(permissionOrigin) {
    return browser.permissions.request({ origins: [permissionOrigin] });
  },
};
