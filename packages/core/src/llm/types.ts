export interface LlmPublicConfig {
  readonly provider: "openai-compatible";
  readonly baseUrl: string;
  readonly model: string;
  readonly temperature?: number;
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

export type PromptTemplateWarning = {
  readonly fieldId: string;
  readonly fieldLabel: string;
  readonly unknownVariables: readonly string[];
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
