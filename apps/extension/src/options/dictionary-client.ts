import type {
  ExtensionErrorCode,
  ExtensionRequest,
  YoudaoPreview,
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
  testConnection(term: string): Promise<YoudaoTestPreview>;
}

export type YoudaoTestPreview = YoudaoPreview;

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

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPreviewSection(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ["entries", "kind"]) || !Array.isArray(value.entries)) {
    return false;
  }
  if (["basic", "web-or-specialized", "english-or-bilingual", "synonyms"].includes(value.kind as string)) {
    return value.entries.every(isString);
  }
  if (value.kind === "word-forms") {
    return value.entries.every((entry) => isRecord(entry)
      && hasExactKeys(entry, ["label", "value"])
      && isString(entry.label) && isString(entry.value));
  }
  if (value.kind === "phrases") {
    return value.entries.every((entry) => {
      const keys = isRecord(entry) ? Object.keys(entry).toSorted().join(",") : "";
      return isRecord(entry)
      && (keys === "phrase" || keys === "meaning,phrase")
      && isString(entry.phrase)
      && (entry.meaning === undefined || isString(entry.meaning));
    });
  }
  return value.kind === "examples" && value.entries.every((entry) => {
    const keys = isRecord(entry) ? Object.keys(entry).toSorted().join(",") : "";
    return isRecord(entry)
      && ["english", "chinese,english", "english,source", "chinese,english,source"].includes(keys)
      && isString(entry.english)
      && (entry.chinese === undefined || isString(entry.chinese))
      && (entry.source === undefined || isString(entry.source));
  });
}

function unwrapDictionaryTestResponse(response: unknown): YoudaoTestPreview {
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
    || !hasExactKeys(response.data, ["providerId", "preview"])
    || response.data.providerId !== "youdao-web"
    || !isRecord(response.data.preview)
    || !hasExactKeys(response.data.preview, ["term", "sections"])
    || typeof response.data.preview.term !== "string"
    || response.data.preview.term.trim().length === 0
    || !Array.isArray(response.data.preview.sections)
    || !response.data.preview.sections.every(isPreviewSection)
  ) {
    throw new OptionsDictionaryError(
      "unexpected-response",
      "The background returned an unexpected response",
    );
  }
  return response.data.preview as unknown as YoudaoTestPreview;
}

export function createOptionsDictionaryClient(
  send: SendDictionaryMessage,
): OptionsDictionaryClient {
  return {
    async testConnection(term) {
      return unwrapDictionaryTestResponse(await send({
        type: "test-dictionary-connection",
        payload: { term },
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
