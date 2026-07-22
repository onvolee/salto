import {
  DICTIONARY_FIELD_TYPES,
  type DictionaryFieldKey
} from "../dictionary/types";
import type { ClientGeneratedId, IsoDateTimeString } from "../shared/sync";

export type QuerySchemaFieldType = "text" | "list";
export type QuerySchemaFieldSource = "llm" | "dictionary";
export type DictionaryQueryField = DictionaryFieldKey;
export type DictionaryQueryFieldSpec = typeof DICTIONARY_FIELD_TYPES;

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

export type QueryTemplateInput = Pick<QueryTemplate, "name" | "fields">;

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
  readonly activeDictionaryProvider: "youdao-web";
}

export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  activeQueryTemplateId: "system-default",
  targetLanguage: "zh-CN",
  highlightEnabled: true,
  themeMode: "system",
  activeDictionaryProvider: "youdao-web"
};

export function isValidQueryTemplate(value: unknown): value is QueryTemplate {
  if (!isRecord(value)
    || !isNonEmptyString(value.id)
    || !isNonEmptyString(value.name)
    || !Array.isArray(value.fields)
    || !isIsoDateTime(value.createdAt)
    || !isIsoDateTime(value.updatedAt)
  ) {
    return false;
  }

  const fieldIds = new Set<string>();
  const orders = new Set<number>();
  let enabledFieldCount = 0;
  for (const field of value.fields) {
    if (!isValidQuerySchemaField(field)) {
      return false;
    }
    if (fieldIds.has(field.id) || orders.has(field.order)) {
      return false;
    }
    fieldIds.add(field.id);
    orders.add(field.order);
    if (field.enabled) {
      enabledFieldCount += 1;
    }
  }

  return value.fields.length > 0
    && enabledFieldCount > 0
    && [...orders].every((order, index) => orders.has(index));
}

export function isValidQueryTemplateInput(value: unknown): value is QueryTemplateInput {
  if (!isRecord(value) || !isNonEmptyString(value.name) || !Array.isArray(value.fields)) {
    return false;
  }

  return isValidQueryTemplate({
    id: "validation",
    name: value.name,
    fields: value.fields,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  });
}

export function isValidExtensionSettings(value: unknown): value is ExtensionSettings {
  return isRecord(value)
    && Object.keys(value).length === 5
    && isNonEmptyString(value.activeQueryTemplateId)
    && isNonEmptyString(value.targetLanguage)
    && typeof value.highlightEnabled === "boolean"
    && (value.themeMode === "system" || value.themeMode === "light" || value.themeMode === "dark")
    && value.activeDictionaryProvider === "youdao-web";
}

function isValidQuerySchemaField(value: unknown): value is QuerySchemaField {
  if (!isRecord(value)
    || !isNonEmptyString(value.id)
    || !isNonEmptyString(value.label)
    || !Number.isInteger(value.order)
    || (value.order as number) < 0
    || typeof value.enabled !== "boolean"
  ) {
    return false;
  }

  if (value.source === "llm") {
    return (value.type === "text" || value.type === "list")
      && typeof value.instruction === "string"
      && value.instruction.trim().length > 0
      && !("dictionaryField" in value);
  }

  if (value.source === "dictionary") {
    if (!("dictionaryField" in value) || !isDictionaryQueryField(value.dictionaryField)) {
      return false;
    }
    return value.type === DICTIONARY_FIELD_TYPES[value.dictionaryField]
      && !("instruction" in value);
  }

  return false;
}

function isDictionaryQueryField(value: unknown): value is DictionaryQueryField {
  return typeof value === "string" && Object.hasOwn(DICTIONARY_FIELD_TYPES, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDateTime(value: unknown): value is IsoDateTimeString {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

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
