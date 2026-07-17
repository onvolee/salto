import type {
  LlmConfigState,
  LlmOptionsState,
  LlmPublicConfig,
} from "./llm/types";
import type { PromptContext, QueryFieldResult } from "./query-template/types";
import type { SaveVocabularyInput, SaveVocabularyResult } from "./vocabulary/ports";

export type TranslateSelectionRequest = {
  readonly type: "translate-selection";
  readonly payload: {
    readonly requestId: string;
    readonly context: PromptContext;
  };
};

export type CancelTranslationRequest = {
  readonly type: "cancel-translation";
  readonly payload: { readonly requestId: string };
};

export type SaveVocabularyRequest = {
  readonly type: "save-vocabulary";
  readonly payload: SaveVocabularyInput;
};

export type ListHighlightTermsRequest = {
  readonly type: "list-highlight-terms";
};

export type GetLlmConfigRequest = {
  readonly type: "get-llm-config";
};

export type SaveLlmConfigRequest = {
  readonly type: "save-llm-config";
  readonly payload: {
    readonly config: LlmPublicConfig;
    readonly apiKey?: string;
  };
};

export type TestLlmConnectionRequest = {
  readonly type: "test-llm-connection";
};

export type ExtensionRequest =
  | TranslateSelectionRequest
  | CancelTranslationRequest
  | SaveVocabularyRequest
  | ListHighlightTermsRequest
  | GetLlmConfigRequest
  | SaveLlmConfigRequest
  | TestLlmConnectionRequest;

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
    }
  | {
      readonly ok: true;
      readonly type: "cancel-translation";
      readonly data: { readonly cancelled: boolean };
    }
  | {
      readonly ok: true;
      readonly type: "get-llm-config";
      readonly data: LlmOptionsState;
    }
  | {
      readonly ok: true;
      readonly type: "save-llm-config";
      readonly data: LlmConfigState;
    }
  | {
      readonly ok: true;
      readonly type: "test-llm-connection";
      readonly data: { readonly connected: true };
    };

export type ExtensionErrorCode =
  | "authentication"
  | "configuration-invalid"
  | "forbidden"
  | "invalid-payload"
  | "invalid-response"
  | "model-not-found"
  | "network"
  | "not-configured"
  | "permission-denied"
  | "provider"
  | "rate-limit"
  | "request-failed"
  | "timeout"
  | "unknown-message";

export type ExtensionErrorResponse = {
  readonly ok: false;
  readonly error: {
    readonly code: ExtensionErrorCode;
    readonly message: string;
  };
};

export type ExtensionResponse = ExtensionSuccessResponse | ExtensionErrorResponse;
