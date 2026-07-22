import {
  DictionaryLookupError,
  normalizeDictionaryFields,
  type DictionaryFieldKey,
  type DictionaryLookupRequest,
  type DictionaryLookupResult,
  type DictionaryPreviewAdapter,
  type YoudaoPreview,
} from "@salto/core";

import {
  createDictionaryHttpClient,
  type DictionaryHttpClient
} from "./dictionary-http-client";
import { parseYoudaoHtml, parseYoudaoPreviewHtml } from "./youdao-web-parser";

export const YOUDAO_ORIGIN = "https://dict.youdao.com";
export const YOUDAO_PERMISSION_ORIGIN = `${YOUDAO_ORIGIN}/*`;

const YOUDAO_FIELDS = [
  "phonetic",
  "partOfSpeech",
  "meaning",
  "synonyms",
  "wordForms"
] as const satisfies readonly DictionaryFieldKey[];

export interface YoudaoWebAdapterDependencies {
  readonly httpClient?: DictionaryHttpClient;
  readonly hasOriginPermission: (origin: string) => Promise<boolean>;
}

export function createYoudaoWebAdapter(
  dependencies: YoudaoWebAdapterDependencies
): DictionaryPreviewAdapter {
  const httpClient = dependencies.httpClient ?? createDictionaryHttpClient({
    retry: 1,
    retryDelayMs: 100
  });

  async function fetchEntryHtml(request: DictionaryLookupRequest, signal: AbortSignal): Promise<string> {
    if (!await dependencies.hasOriginPermission(YOUDAO_PERMISSION_ORIGIN)) {
      throw new DictionaryLookupError("permission-denied");
    }
    const url = `${YOUDAO_ORIGIN}/w/eng/${encodeURIComponent(request.term)}/`;
    return httpClient.getText({ url, signal });
  }

  return {
    capabilities: {
      providerId: "youdao-web",
      supportedLanguages: ["en"],
      supportedFields: YOUDAO_FIELDS
    },

    async lookup(request, signal): Promise<DictionaryLookupResult> {
      const html = await fetchEntryHtml(request, signal);
      const parsed = parseYoudaoHtml(html);
      const fields = normalizeDictionaryFields(
        parsed.status === "found" ? parsed.fields : {},
        YOUDAO_FIELDS,
        parsed.status === "not-found" ? { missingReason: "not-found" } : {}
      );

      return {
        providerId: "youdao-web",
        term: request.term,
        language: request.language,
        fields
      };
    },

    async preview(request, signal): Promise<YoudaoPreview> {
      const parsed = parseYoudaoPreviewHtml(await fetchEntryHtml(request, signal));
      if (parsed.status === "not-found") {
        throw new DictionaryLookupError("not-found");
      }
      return parsed.preview;
    },
  };
}
