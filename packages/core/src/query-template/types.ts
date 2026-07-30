import {
  type DictionaryExample,
  type DictionaryFieldKey
} from "../dictionary/types";
import type { ClientGeneratedId, IsoDateTimeString } from "../shared/sync";

export type QuerySchemaFieldType = "text" | "list" | "examples";
export type LlmQuerySchemaFieldType = Exclude<QuerySchemaFieldType, "examples">;
export type QuerySchemaFieldSource = "llm" | "dictionary";
export const DICTIONARY_QUERY_FIELD_TYPES = {
  translation: "text",
  basicDefinition: "text",
  phonetic: "text",
  partOfSpeech: "text",
  synonyms: "list",
  wordForms: "list",
  examples: "examples",
} as const;
export type DictionaryQueryFieldSpec = typeof DICTIONARY_QUERY_FIELD_TYPES;
export type DictionaryQueryField = keyof DictionaryQueryFieldSpec
  | Extract<DictionaryFieldKey, "meaning">;

type DictionaryQueryFieldType<K extends DictionaryQueryField> =
  K extends keyof DictionaryQueryFieldSpec
    ? DictionaryQueryFieldSpec[K]
    : "text";

type TemplateFieldContentBase = {
  readonly label: string;
  readonly description?: string;
};

export type LlmTemplateFieldContent = TemplateFieldContentBase & {
  readonly source: "llm";
  readonly type: LlmQuerySchemaFieldType;
  readonly instruction: string;
  readonly dictionaryField?: never;
};

export type DictionaryTemplateFieldContent = {
  [K in DictionaryQueryField]: TemplateFieldContentBase & {
    readonly source: "dictionary";
    readonly dictionaryField: K;
    readonly type: DictionaryQueryFieldType<K>;
    readonly instruction?: never;
  };
}[DictionaryQueryField];

export type TemplateFieldContent =
  | LlmTemplateFieldContent
  | DictionaryTemplateFieldContent;

export function templateFieldSupportsCustomCss(content: TemplateFieldContent): boolean {
  return content.type !== "examples";
}

type TemplateFieldDefinitionMetadata = {
  readonly id: ClientGeneratedId;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
};

export type LlmTemplateFieldDefinition = LlmTemplateFieldContent & TemplateFieldDefinitionMetadata;
export type DictionaryTemplateFieldDefinition = DictionaryTemplateFieldContent & TemplateFieldDefinitionMetadata;
export type TemplateFieldDefinition =
  | LlmTemplateFieldDefinition
  | DictionaryTemplateFieldDefinition;
export type TemplateFieldDefinitionInput = TemplateFieldContent;

type QuerySchemaFieldBase = {
  readonly id: ClientGeneratedId;
  readonly definitionId: ClientGeneratedId;
  readonly order: number;
  readonly enabled: boolean;
  readonly keyCss?: string;
  readonly valueCss?: string;
};

export type QuerySchemaField = QuerySchemaFieldBase & {
  readonly content: TemplateFieldContent;
};

export type LlmQuerySchemaField = QuerySchemaFieldBase & {
  readonly content: LlmTemplateFieldContent;
};

export type DictionaryQuerySchemaField = QuerySchemaFieldBase & {
  readonly content: DictionaryTemplateFieldContent;
};

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
      readonly status: "ready";
      readonly type: "examples";
      readonly value: readonly DictionaryExample[];
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
  readonly highlightSameWords: boolean;
  readonly themeMode: "system" | "light" | "dark";
  readonly activeDictionaryProvider: "youdao-web";
  readonly panelWidth: number;
  readonly panelHeight: number;
}

export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  activeQueryTemplateId: "system-default",
  targetLanguage: "zh-CN",
  highlightEnabled: true,
  highlightSameWords: false,
  themeMode: "system",
  activeDictionaryProvider: "youdao-web",
  panelWidth: 360,
  panelHeight: 220,
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

export function isValidTemplateFieldDefinition(value: unknown): value is TemplateFieldDefinition {
  return isRecord(value)
    && isNonEmptyString(value.id)
    && isIsoDateTime(value.createdAt)
    && isIsoDateTime(value.updatedAt)
    && isValidTemplateFieldContent(value);
}

export function isValidTemplateFieldDefinitionInput(value: unknown): value is TemplateFieldDefinitionInput {
  return isValidTemplateFieldContent(value);
}

export function isValidExtensionSettings(value: unknown): value is ExtensionSettings {
  return isRecord(value)
    && isNonEmptyString(value.activeQueryTemplateId)
    && isNonEmptyString(value.targetLanguage)
    && typeof value.highlightEnabled === "boolean"
    && typeof value.highlightSameWords === "boolean"
    && (value.themeMode === "system" || value.themeMode === "light" || value.themeMode === "dark")
    && value.activeDictionaryProvider === "youdao-web"
    && typeof value.panelWidth === "number"
    && typeof value.panelHeight === "number";
}

function isValidQuerySchemaField(value: unknown): value is QuerySchemaField {
  if (!isRecord(value)
    || !isNonEmptyString(value.id)
    || !isNonEmptyString(value.definitionId)
    || !isValidTemplateFieldContent(value.content)
    || !Number.isInteger(value.order)
    || (value.order as number) < 0
    || typeof value.enabled !== "boolean"
    || (value.keyCss !== undefined && typeof value.keyCss !== "string")
    || (value.valueCss !== undefined && typeof value.valueCss !== "string")
  ) {
    return false;
  }

  return true;
}

function isValidTemplateFieldContent(value: unknown): value is TemplateFieldContent {
  if (!isRecord(value)
    || !isNonEmptyString(value.label)
    || (value.description !== undefined && typeof value.description !== "string")
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
    return value.type === dictionaryQueryFieldType(value.dictionaryField)
      && !("instruction" in value);
  }

  return false;
}

function isDictionaryQueryField(value: unknown): value is DictionaryQueryField {
  return value === "meaning"
    || (typeof value === "string" && Object.hasOwn(DICTIONARY_QUERY_FIELD_TYPES, value));
}

function dictionaryQueryFieldType(field: DictionaryQueryField): QuerySchemaFieldType {
  return field === "meaning" ? "text" : DICTIONARY_QUERY_FIELD_TYPES[field];
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
  const [translationDefinition, phoneticDefinition, partOfSpeechDefinition] =
    createDefaultTemplateFieldDefinitions(seedTime);
  return {
    id: "system-default",
    name: "Default",
    createdAt: seedTime,
    updatedAt: seedTime,
    fields: [
      createTemplateFieldSnapshot(
        translationDefinition,
        "system-default:translation",
        0,
      ),
      createTemplateFieldSnapshot(
        phoneticDefinition,
        "system-default:phonetic",
        1,
      ),
      createTemplateFieldSnapshot(
        partOfSpeechDefinition,
        "system-default:part-of-speech",
        2,
      ),
    ]
  };
}

export function createDefaultTemplateFieldDefinitions(
  seedTime: IsoDateTimeString,
): readonly [
  DictionaryTemplateFieldDefinition,
  DictionaryTemplateFieldDefinition,
  DictionaryTemplateFieldDefinition,
] {
  return [
    {
      id: "system-field:translation",
      label: "翻译",
      source: "dictionary",
      type: "text",
      dictionaryField: "translation",
      createdAt: seedTime,
      updatedAt: seedTime,
    },
    {
      id: "system-field:phonetic",
      label: "音标",
      source: "dictionary",
      type: "text",
      dictionaryField: "phonetic",
      createdAt: seedTime,
      updatedAt: seedTime,
    },
    {
      id: "system-field:part-of-speech",
      label: "词性",
      source: "dictionary",
      type: "text",
      dictionaryField: "partOfSpeech",
      createdAt: seedTime,
      updatedAt: seedTime,
    },
  ];
}

export function templateFieldContentFromDefinition(
  definition: TemplateFieldDefinition,
): TemplateFieldContent {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...content } = definition;
  return { ...content };
}

export function createTemplateFieldSnapshot(
  definition: TemplateFieldDefinition,
  resultId: ClientGeneratedId,
  order: number,
): QuerySchemaField {
  return {
    id: resultId,
    definitionId: definition.id,
    content: templateFieldContentFromDefinition(definition),
    order,
    enabled: true,
  } as QuerySchemaField;
}
