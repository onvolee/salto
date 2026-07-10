export interface LlmConfig {
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKeyRef: string;
}

export interface LlmRequest {
  readonly instruction: string;
  readonly input: string;
}

export interface LlmResponse {
  readonly text: string;
}

export interface LlmClient {
  complete(request: LlmRequest): Promise<LlmResponse>;
}
