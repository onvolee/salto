export interface LlmPublicConfig {
  readonly provider: "openai-compatible";
  readonly baseUrl: string;
  readonly model: string;
  readonly temperature?: number;
  readonly enableThinking?: boolean;
}

export interface LlmSecret {
  readonly apiKey: string;
}

export type LlmConfigState = {
  readonly config?: LlmPublicConfig;
  readonly hasApiKey: boolean;
};

export type PromptContextVariable =
  | "selection"
  | "sentence"
  | "paragraphs"
  | "targetLanguage"
  | "webTitle"
  | "webUrl"
  | "webContent";

export type PromptMalformedReason =
  | "empty-variable"
  | "invalid-identifier"
  | "unmatched-opening-braces"
  | "unmatched-closing-braces"
  | "triple-brace-run";

export type PromptTemplateToken =
  | {
      readonly kind: "text";
      readonly value: string;
      readonly start: number;
      readonly end: number;
    }
  | {
      readonly kind: "variable";
      readonly name: string;
      readonly raw: string;
      readonly start: number;
      readonly end: number;
    }
  | {
      readonly kind: "malformed";
      readonly raw: string;
      readonly reason: PromptMalformedReason;
      readonly start: number;
      readonly end: number;
    };

export type PromptTemplateDiagnostic =
  | {
      readonly kind: "known";
      readonly variable: PromptContextVariable;
      readonly start: number;
      readonly end: number;
    }
  | {
      readonly kind: "unknown";
      readonly variable: string;
      readonly start: number;
      readonly end: number;
    }
  | {
      readonly kind: "malformed";
      readonly raw: string;
      readonly reason: PromptMalformedReason;
      readonly start: number;
      readonly end: number;
    };

export type PromptTemplateParseResult = {
  readonly tokens: readonly PromptTemplateToken[];
  readonly diagnostics: readonly PromptTemplateDiagnostic[];
};

export type PromptTemplateWarning = {
  readonly fieldId: string;
  readonly fieldLabel: string;
  readonly unknownVariables: readonly string[];
  readonly malformedTokens: readonly {
    readonly raw: string;
    readonly reason: PromptMalformedReason;
  }[];
};

export type PromptTemplateAnalysis = {
  readonly referencedVariables: readonly PromptContextVariable[];
  readonly warnings: readonly PromptTemplateWarning[];
};

export type LlmOptionsState = LlmConfigState & {
  readonly promptAnalysis: PromptTemplateAnalysis;
};

export interface LlmCompletionField {
  readonly id: string;
  readonly type: "text" | "list";
  readonly instruction: string;
}

export interface LlmCompletionRequest {
  readonly fields: readonly LlmCompletionField[];
}

export interface LlmClient {
  complete(request: LlmCompletionRequest): Promise<unknown>;
}
