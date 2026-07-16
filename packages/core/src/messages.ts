import type { PromptContext, QueryFieldResult } from "./query-template/types";
import type { SaveVocabularyInput, SaveVocabularyResult } from "./vocabulary/ports";

export type TranslateSelectionRequest = {
  readonly type: "translate-selection";
  readonly payload: { readonly context: PromptContext };
};

export type SaveVocabularyRequest = {
  readonly type: "save-vocabulary";
  readonly payload: SaveVocabularyInput;
};

export type ListHighlightTermsRequest = {
  readonly type: "list-highlight-terms";
};

export type ExtensionRequest =
  | TranslateSelectionRequest
  | SaveVocabularyRequest
  | ListHighlightTermsRequest;

export type ExtensionSuccessResponse =
  | {
      readonly ok: true;
      readonly type: "translate-selection";
      readonly data: {
        readonly templateId: string;
        readonly templateName: string;
        readonly schema: readonly { readonly id: string; readonly label: string }[];
        readonly fields: readonly QueryFieldResult[];
      };
    }
  | { readonly ok: true; readonly type: "save-vocabulary"; readonly data: SaveVocabularyResult }
  | {
      readonly ok: true;
      readonly type: "list-highlight-terms";
      readonly data: { readonly terms: readonly string[] };
    };

export type ExtensionErrorResponse = {
  readonly ok: false;
  readonly error: {
    readonly code: "unknown-message" | "invalid-payload" | "request-failed";
    readonly message: string;
  };
};

export type ExtensionResponse = ExtensionSuccessResponse | ExtensionErrorResponse;
