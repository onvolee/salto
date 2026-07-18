export type DictionaryLookupErrorCode =
  | "unsupported-language"
  | "cancelled"
  | "timeout"
  | "response-too-large"
  | "invalid-content-type"
  | "parser-failure"
  | "network"
  | "provider-error";

const DICTIONARY_LOOKUP_ERROR_MESSAGES: Record<DictionaryLookupErrorCode, string> = {
  "unsupported-language": "The dictionary provider does not support this language",
  cancelled: "The dictionary lookup was cancelled",
  timeout: "The dictionary lookup timed out",
  "response-too-large": "The dictionary response exceeded the size limit",
  "invalid-content-type": "The dictionary provider returned an unsupported content type",
  "parser-failure": "The dictionary response could not be parsed",
  network: "The dictionary provider could not be reached",
  "provider-error": "The dictionary provider request failed"
};

export class DictionaryLookupError extends Error {
  constructor(readonly code: DictionaryLookupErrorCode) {
    super(DICTIONARY_LOOKUP_ERROR_MESSAGES[code]);
    this.name = "DictionaryLookupError";
  }
}
