import {
  createTemplateFieldSnapshot,
  isValidQueryTemplateInput,
  isValidTemplateFieldDefinitionInput,
  type QuerySchemaField,
  type QueryTemplate,
  type QueryTemplateInput,
  type TemplateFieldContent,
  type TemplateFieldDefinition,
} from "@salto/core";

export type TemplateFieldDraft = {
  readonly id: string;
  readonly definitionId: string;
  readonly content: TemplateFieldContent;
  readonly order: number;
  readonly enabled: boolean;
  readonly keyCss: string;
  readonly valueCss: string;
  readonly extensions: Readonly<Record<string, unknown>>;
};

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

function fieldExtensionData(field: QuerySchemaField): Record<string, unknown> {
  const {
    id: _id,
    definitionId: _definitionId,
    content: _content,
    order: _order,
    enabled: _enabled,
    keyCss: _keyCss,
    valueCss: _valueCss,
    ...extensions
  } = field;
  return extensions;
}

function templateExtensionData(template: QueryTemplate): Record<string, unknown> {
  const {
    id: _id,
    name: _name,
    fields: _fields,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...extensions
  } = template as QueryTemplate & Record<string, unknown>;
  return extensions;
}

export function fieldDraftFromQueryField(field: QuerySchemaField): TemplateFieldDraft {
  return {
    id: field.id,
    definitionId: field.definitionId,
    content: { ...field.content },
    order: field.order,
    enabled: field.enabled,
    keyCss: field.keyCss ?? "",
    valueCss: field.valueCss ?? "",
    extensions: fieldExtensionData(field),
  };
}

export function createFieldDraftFromDefinition(
  definition: TemplateFieldDefinition,
  resultId: string,
  order: number,
): TemplateFieldDraft {
  return fieldDraftFromQueryField(
    createTemplateFieldSnapshot(definition, resultId, order),
  );
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
  return {
    ...field.extensions,
    id: field.id,
    definitionId: field.definitionId,
    content: { ...field.content },
    order: field.order,
    enabled: field.enabled,
    ...(field.keyCss.trim() ? { keyCss: field.keyCss.trim() } : {}),
    ...(field.valueCss.trim() ? { valueCss: field.valueCss.trim() } : {}),
  } as QuerySchemaField;
}

export function normalizeFieldOrders(
  fields: readonly TemplateFieldDraft[],
): TemplateFieldDraft[] {
  return fields.map((field, index) => ({ ...field, order: index }));
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
  for (const field of draft.fields) {
    const fieldErrors: Record<string, string> = {};
    if (!field.id.trim()) fieldErrors.id = "字段 ID 不能为空";
    if (!field.definitionId.trim()) fieldErrors.definitionId = "字段定义 ID 不能为空";
    if (!isValidTemplateFieldDefinitionInput(field.content)) {
      fieldErrors.content = "字段快照无效";
    }
    if (!Number.isInteger(field.order) || field.order < 0) {
      fieldErrors.order = "字段顺序无效";
    }
    if (ids.has(field.id)) fieldErrors.id = "字段 ID 不能重复";
    if (orders.has(field.order)) fieldErrors.order = "字段顺序不能重复";
    ids.add(field.id);
    orders.add(field.order);
    if (field.enabled) enabledCount += 1;
    if (Object.keys(fieldErrors).length > 0) errors.field[field.id] = fieldErrors;
  }

  if (draft.fields.length > 0 && [...orders].some((_, index) => !orders.has(index))) {
    errors.fields = "字段顺序必须从 0 开始连续排列";
  }
  if (draft.fields.length > 0 && enabledCount === 0) {
    errors.fields = "模板至少需要一个启用字段";
  }

  const fields = normalizeFieldOrders(draft.fields).map(queryFieldFromDraft);
  const data = { ...draft.extensions, name: draft.name.trim(), fields };
  if (!errors.name
    && !errors.fields
    && Object.keys(errors.field).length === 0
    && !isValidQueryTemplateInput(data)
  ) {
    errors.form = "模板配置无效";
  }

  if (errors.form || errors.name || errors.fields || Object.keys(errors.field).length > 0) {
    return { success: false, errors };
  }
  return { success: true, data };
}

export function createNewTemplateDraft(
  now: string,
  fields: readonly TemplateFieldDraft[] = [],
): TemplateDraft {
  return {
    id: "new",
    name: "新模板",
    createdAt: now,
    updatedAt: now,
    extensions: {},
    fields: normalizeFieldOrders(fields),
  };
}
