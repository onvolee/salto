import { z } from "zod";

import {
  DICTIONARY_FIELD_TYPES,
  type DictionaryQueryField,
  type QuerySchemaField,
  type QueryTemplate,
  type QueryTemplateInput,
} from "@salto/core";

const dictionaryFieldSchema = z.enum(
  Object.keys(DICTIONARY_FIELD_TYPES) as [DictionaryQueryField, ...DictionaryQueryField[]],
);

const fieldDraftSchema = z.object({
  id: z.string().trim().min(1, "字段 ID 不能为空"),
  label: z.string().trim().min(1, "字段名称不能为空"),
  source: z.enum(["llm", "dictionary"]),
  type: z.enum(["text", "list"]),
  instruction: z.string(),
  dictionaryField: z.union([dictionaryFieldSchema, z.literal("")]),
  order: z.number().int().min(0),
  enabled: z.boolean(),
});

export type TemplateFieldDraft = z.infer<typeof fieldDraftSchema>;

export type TemplateDraft = {
  readonly id: string;
  readonly name: string;
  readonly fields: readonly TemplateFieldDraft[];
  readonly createdAt: QueryTemplate["createdAt"];
  readonly updatedAt: QueryTemplate["updatedAt"];
  readonly extensions: Readonly<Record<string, unknown>>;
};

export type TemplateValidationErrors = {
  readonly form?: string;
  readonly name?: string;
  readonly fields?: string;
  readonly field: Readonly<Record<string, Readonly<Record<string, string>>>>;
};

export type TemplateValidationResult =
  | { readonly success: true; readonly data: QueryTemplateInput | QueryTemplate }
  | { readonly success: false; readonly errors: TemplateValidationErrors };

function extensionData(field: QuerySchemaField): Record<string, unknown> {
  const { id, label, source, type, instruction, dictionaryField, order, enabled, ...extensions } = field;
  void id;
  void label;
  void source;
  void type;
  void instruction;
  void dictionaryField;
  void order;
  void enabled;
  return extensions;
}

function templateExtensionData(template: QueryTemplate): Record<string, unknown> {
  const { id, name, fields, createdAt, updatedAt, ...extensions } = template as QueryTemplate & Record<string, unknown>;
  void id;
  void name;
  void fields;
  void createdAt;
  void updatedAt;
  return extensions;
}

export function fieldDraftFromQueryField(field: QuerySchemaField): TemplateFieldDraft {
  return {
    id: field.id,
    label: field.label,
    source: field.source,
    type: field.type,
    instruction: field.source === "llm" ? field.instruction : "",
    dictionaryField: field.source === "dictionary" ? field.dictionaryField : "",
    order: field.order,
    enabled: field.enabled,
    ...extensionData(field),
  } as TemplateFieldDraft;
}

export function templateDraftFromQueryTemplate(template: QueryTemplate): TemplateDraft {
  return {
    id: template.id,
    name: template.name,
    fields: template.fields.map(fieldDraftFromQueryField),
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    extensions: templateExtensionData(template),
  };
}

export function queryFieldFromDraft(field: TemplateFieldDraft): QuerySchemaField {
  const extensions = { ...field } as Record<string, unknown>;
  delete extensions.id;
  delete extensions.label;
  delete extensions.source;
  delete extensions.type;
  delete extensions.instruction;
  delete extensions.dictionaryField;
  delete extensions.order;
  delete extensions.enabled;

  if (field.source === "llm") {
    return {
      ...extensions,
      id: field.id,
      label: field.label.trim(),
      source: "llm",
      type: field.type,
      instruction: field.instruction.trim(),
      order: field.order,
      enabled: field.enabled,
    } as QuerySchemaField;
  }

  const dictionaryField = field.dictionaryField as DictionaryQueryField;
  return {
    ...extensions,
    id: field.id,
    label: field.label.trim(),
    source: "dictionary",
    dictionaryField,
    type: DICTIONARY_FIELD_TYPES[dictionaryField],
    order: field.order,
    enabled: field.enabled,
  } as QuerySchemaField;
}

export function normalizeFieldOrders(
  fields: readonly TemplateFieldDraft[],
): TemplateFieldDraft[] {
  return fields.map((field, index) => ({ ...field, order: index }));
}

export function switchDraftSource(
  field: TemplateFieldDraft,
  source: TemplateFieldDraft["source"],
): TemplateFieldDraft {
  if (field.source === source) return field;

  return source === "llm"
    ? { ...field, source, type: "text", instruction: "", dictionaryField: "" }
    : {
      ...field,
      source,
      type: DICTIONARY_FIELD_TYPES.phonetic,
      instruction: "",
      dictionaryField: "phonetic",
    };
}

export function validateTemplateDraft(
  draft: Pick<TemplateDraft, "name" | "fields"> & Partial<Pick<TemplateDraft, "extensions">>,
): TemplateValidationResult {
  const errors: {
    form?: string;
    name?: string;
    fields?: string;
    field: Record<string, Record<string, string>>;
  } = { field: {} };

  if (!draft.name.trim()) errors.name = "模板名称不能为空";
  if (draft.fields.length === 0) errors.fields = "模板至少需要一个字段";

  const ids = new Set<string>();
  const orders = new Set<number>();
  let enabledCount = 0;

  draft.fields.forEach((field) => {
    const fieldErrors: Record<string, string> = {};
    const parsed = fieldDraftSchema.safeParse(field);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        fieldErrors[key] ??= issue.message;
      }
    } else if (field.source === "llm") {
      if (!field.instruction.trim()) fieldErrors.instruction = "Instruction 不能为空";
      if (field.dictionaryField) fieldErrors.dictionaryField = "LLM 字段不能包含词典字段";
    } else {
      if (!field.dictionaryField) fieldErrors.dictionaryField = "请选择词典字段";
      if (field.type !== DICTIONARY_FIELD_TYPES[field.dictionaryField as DictionaryQueryField]) {
        fieldErrors.type = "字段类型必须由词典字段决定";
      }
      if (field.instruction) fieldErrors.instruction = "词典字段不能包含 instruction";
    }

    if (ids.has(field.id)) fieldErrors.id = "字段 ID 不能重复";
    if (orders.has(field.order)) fieldErrors.order = "字段顺序不能重复";
    ids.add(field.id);
    orders.add(field.order);
    if (field.enabled) enabledCount += 1;
    if (Object.keys(fieldErrors).length > 0) errors.field[field.id] = fieldErrors;
  });

  if (draft.fields.length > 0 && [...orders].some((order, index) => !orders.has(index))) {
    errors.fields = "字段顺序必须从 0 开始连续排列";
  }
  if (draft.fields.length > 0 && enabledCount === 0) {
    errors.fields = "模板至少需要一个启用字段";
  }

  if (errors.name || errors.fields || Object.keys(errors.field).length > 0) {
    return { success: false, errors };
  }

  const fields = normalizeFieldOrders(draft.fields).map(queryFieldFromDraft);
  return {
    success: true,
    data: { ...draft.extensions, name: draft.name.trim(), fields },
  };
}

export function createNewTemplateDraft(now: string, fieldId: string): TemplateDraft {
  return {
    id: "new",
    name: "新模板",
    createdAt: now,
    updatedAt: now,
    extensions: {},
    fields: [{
      id: fieldId,
      label: "翻译",
      source: "llm",
      type: "text",
      instruction: "Translate {{selection}} into {{targetLanguage}}.",
      dictionaryField: "",
      order: 0,
      enabled: true,
    }],
  };
}
