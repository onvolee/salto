import type { ClientGeneratedId } from "../shared/sync";

export type QuerySchemaFieldType = "text" | "markdown";
export type QuerySchemaFieldSource = "llm" | "youdao-web" | "cambridge-web";

export interface QuerySchemaField {
  readonly id: ClientGeneratedId;
  readonly label: string;
  readonly type: QuerySchemaFieldType;
  readonly source: QuerySchemaFieldSource;
  readonly instruction: string;
  readonly order: number;
  readonly enabled: boolean;
}

export interface QueryTemplate {
  readonly id: ClientGeneratedId;
  readonly name: string;
  readonly targetLanguage: string;
  readonly fields: readonly QuerySchemaField[];
}

export interface PromptContext {
  readonly selection: string;
  readonly sentence?: string;
  readonly targetLanguage: string;
  readonly pageTitle?: string;
  readonly pageUrl?: string;
  readonly pageContent?: string;
}
