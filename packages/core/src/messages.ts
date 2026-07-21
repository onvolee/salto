import type {
  LlmConfigState,
  LlmOptionsState,
  LlmPublicConfig,
} from "./llm/types";
import {
  isValidExtensionSettings,
  type ExtensionSettings,
  type PromptContext,
  type QueryFieldResult,
  type QueryTemplate,
  type QueryTemplateInput,
} from "./query-template/types";
import type {
  SelectionPath,
} from "./vocabulary/types";
import type { SaveVocabularyInput, SaveVocabularyResult } from "./vocabulary/ports";

export type TranslateSelectionRequest = {
  readonly type: "translate-selection";
  readonly payload: {
    readonly requestId: string;
    readonly context: PromptContext;
    readonly template: QueryTemplate;
  };
};

export type ActiveQueryTemplateResolution =
  | { readonly status: "active" }
  | {
      readonly status: "recovered";
      readonly code: "active-template-unavailable";
    };

export type GetActiveQueryTemplateRequest = {
  readonly type: "get-active-query-template";
};

export type CancelTranslationRequest = {
  readonly type: "cancel-translation";
  readonly payload: { readonly requestId: string };
};

export type SaveVocabularyRequest = {
  readonly type: "save-vocabulary";
  readonly payload: SaveVocabularyInput;
};

export type CheckVocabularyExistsRequest = {
  readonly type: "check-vocabulary-exists";
  readonly payload: {
    readonly term: string;
    readonly language: string;
  };
};

export type RetryEnrichmentRequest = {
  readonly type: "retry-enrichment";
  readonly payload?: {
    readonly vocabularyItemId?: string;
  };
};

export type ListFailedEnrichmentRequest = {
  readonly type: "list-failed-enrichment";
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

export type TestDictionaryConnectionRequest = {
  readonly type: "test-dictionary-connection";
};

export type ListQueryTemplatesRequest = {
  readonly type: "list-query-templates";
};

export type CreateQueryTemplateRequest = {
  readonly type: "create-query-template";
  readonly payload: QueryTemplateInput;
};

export type CopyQueryTemplateRequest = {
  readonly type: "copy-query-template";
  readonly payload: { readonly templateId: string };
};

export type UpdateQueryTemplateRequest = {
  readonly type: "update-query-template";
  readonly payload: { readonly template: QueryTemplate };
};

export type DeleteQueryTemplateRequest = {
  readonly type: "delete-query-template";
  readonly payload: { readonly templateId: string };
};

export type GetExtensionSettingsRequest = {
  readonly type: "get-extension-settings";
};

export type SaveExtensionSettingsRequest = {
  readonly type: "save-extension-settings";
  readonly payload: ExtensionSettings;
};

export type ExtensionSettingsChangedNotification = {
  readonly type: "extension-settings-changed";
  readonly payload: ExtensionSettings;
};

export type TranslationFieldReadyNotification = {
  readonly type: "translation-field-ready";
  readonly payload: {
    readonly requestId: string;
    readonly fieldId: string;
    readonly result: QueryFieldResult;
  };
};

export type ExtensionNotification =
  | ExtensionSettingsChangedNotification
  | TranslationFieldReadyNotification;

export function isExtensionNotification(value: unknown): value is ExtensionNotification {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const type = (value as { readonly type?: unknown }).type;
  if (type === "extension-settings-changed") {
    return isValidExtensionSettings((value as { readonly payload?: unknown }).payload);
  }
  if (type === "translation-field-ready") {
    const payload = (value as { readonly payload?: unknown }).payload;
    return typeof payload === "object"
      && payload !== null
      && typeof (payload as { readonly requestId?: unknown }).requestId === "string"
      && typeof (payload as { readonly fieldId?: unknown }).fieldId === "string"
      && typeof (payload as { readonly result?: unknown }).result === "object"
      && (payload as { readonly result?: unknown }).result !== null;
  }
  return false;
}

export type ExtensionRequest =
  | TranslateSelectionRequest
  | GetActiveQueryTemplateRequest
  | CancelTranslationRequest
  | SaveVocabularyRequest
  | CheckVocabularyExistsRequest
  | RetryEnrichmentRequest
  | ListFailedEnrichmentRequest
  | ListHighlightTermsRequest
  | GetLlmConfigRequest
  | SaveLlmConfigRequest
  | TestLlmConnectionRequest
  | TestDictionaryConnectionRequest
  | ListQueryTemplatesRequest
  | CreateQueryTemplateRequest
  | CopyQueryTemplateRequest
  | UpdateQueryTemplateRequest
  | DeleteQueryTemplateRequest
  | GetExtensionSettingsRequest
  | SaveExtensionSettingsRequest;

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
  | {
      readonly ok: true;
      readonly type: "get-active-query-template";
      readonly data: {
        readonly template: QueryTemplate;
        readonly resolution: ActiveQueryTemplateResolution;
      };
    }
  | { readonly ok: true; readonly type: "save-vocabulary"; readonly data: SaveVocabularyResult }
  | { readonly ok: true; readonly type: "check-vocabulary-exists"; readonly data: { readonly exists: boolean } }
  | { readonly ok: true; readonly type: "retry-enrichment"; readonly data: { readonly reset: number } }
  | {
      readonly ok: true;
      readonly type: "list-failed-enrichment";
      readonly data: {
        readonly items: readonly {
          readonly vocabularyItemId: string;
          readonly term: string;
          readonly fields: readonly string[];
        }[];
      };
    }
  | {
      readonly ok: true;
      readonly type: "list-highlight-terms";
      readonly data: {
        readonly enabled: boolean;
        readonly terms: readonly string[];
        readonly paths: readonly {
          readonly term: string;
          readonly path: SelectionPath;
        }[];
      };
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
    }
  | {
      readonly ok: true;
      readonly type: "test-dictionary-connection";
      readonly data: {
        readonly connected: true;
        readonly providerId: "youdao-web";
      };
    }
  | {
      readonly ok: true;
      readonly type: "list-query-templates";
      readonly data: {
        readonly templates: readonly QueryTemplate[];
        readonly activeQueryTemplateId: string;
      };
    }
  | {
      readonly ok: true;
      readonly type: "create-query-template" | "copy-query-template" | "update-query-template";
      readonly data: QueryTemplate;
    }
  | {
      readonly ok: true;
      readonly type: "delete-query-template";
      readonly data: { readonly deletedTemplateId: string; readonly activeQueryTemplateId: string };
    }
  | {
      readonly ok: true;
      readonly type: "get-extension-settings" | "save-extension-settings";
      readonly data: ExtensionSettings;
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
  | "template-not-found"
  | "template-protected"
  | "last-template"
  | "template-invalid"
  | "settings-invalid"
  | "unknown-message";

export type ExtensionErrorResponse = {
  readonly ok: false;
  readonly error: {
    readonly code: ExtensionErrorCode;
    readonly message: string;
  };
};

export type ExtensionResponse = ExtensionSuccessResponse | ExtensionErrorResponse;
