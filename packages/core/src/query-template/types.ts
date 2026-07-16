import type { ClientGeneratedId, IsoDateTimeString } from "../shared/sync";

export type QuerySchemaFieldType = "text" | "list";
export type QuerySchemaFieldSource = "llm" | "dictionary";
export type DictionaryQueryField =
  | "phonetic"
  | "partOfSpeech"
  | "meaning"
  | "synonyms"
  | "wordForms";

export type DictionaryQueryFieldSpec = {
  readonly phonetic: "text";
  readonly partOfSpeech: "text";
  readonly meaning: "text";
  readonly synonyms: "list";
  readonly wordForms: "list";
};

type QuerySchemaFieldBase = {
  readonly id: ClientGeneratedId;
  readonly label: string;
  readonly order: number;
  readonly enabled: boolean;
};

export type LlmQuerySchemaField = QuerySchemaFieldBase & {
  readonly source: "llm";
  readonly type: QuerySchemaFieldType;
  readonly instruction: string;
  readonly dictionaryField?: never;
};

export type DictionaryQuerySchemaField = {
  [K in DictionaryQueryField]: QuerySchemaFieldBase & {
    readonly source: "dictionary";
    readonly dictionaryField: K;
    readonly type: DictionaryQueryFieldSpec[K];
    readonly instruction?: never;
  };
}[DictionaryQueryField];

export type QuerySchemaField = LlmQuerySchemaField | DictionaryQuerySchemaField;

export interface QueryTemplate {
  readonly id: ClientGeneratedId;
  readonly name: string;
  readonly fields: readonly QuerySchemaField[];
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
}

export interface PromptContext {
  readonly selection: string;
  readonly sentence: string;
  readonly paragraphs: string;
  readonly targetLanguage: string;
  readonly webTitle: string;
  readonly webUrl: string;
  readonly webContent: string;
}

export type QueryFieldResult =
  | {
      readonly fieldId: ClientGeneratedId;
      readonly status: "ready";
      readonly type: "text";
      readonly value: string;
    }
  | {
      readonly fieldId: ClientGeneratedId;
      readonly status: "ready";
      readonly type: "list";
      readonly value: readonly string[];
    }
  | {
      readonly fieldId: ClientGeneratedId;
      readonly status: "unavailable";
      readonly reason: "not-configured" | "not-found" | "unsupported" | "missing";
    }
  | {
      readonly fieldId: ClientGeneratedId;
      readonly status: "failed";
      readonly error: {
        readonly code: string;
        readonly message: string;
      };
    };

export interface ExtensionSettings {
  readonly activeQueryTemplateId: string;
  readonly targetLanguage: string;
  readonly highlightEnabled: boolean;
  readonly themeMode: "system" | "light" | "dark";
  readonly activeDictionaryProvider?: "youdao-web" | "cambridge-web";
}

export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  activeQueryTemplateId: "system-default",
  targetLanguage: "zh-CN",
  highlightEnabled: true,
  themeMode: "system"
};

export function createDefaultQueryTemplate(seedTime: IsoDateTimeString): QueryTemplate {
  return {
    id: "system-default",
    name: "Default",
    createdAt: seedTime,
    updatedAt: seedTime,
    fields: [
      {
        id: "system-default:translation",
        label: "Translation",
        source: "llm",
        type: "text",
        instruction:
          "Translate {{selection}} into {{targetLanguage}}. " +
          "Use {{sentence}} only when needed for disambiguation. " +
          "Return only the translation.",
        order: 0,
        enabled: true
      },
      {
        id: "system-default:key-points",
        label: "Key points",
        source: "llm",
        type: "list",
        instruction:
          "List the key meanings or usage notes for {{selection}} in " +
          "{{sentence}}. Write each item in {{targetLanguage}}.",
        order: 1,
        enabled: true
      }
    ]
  };
}
