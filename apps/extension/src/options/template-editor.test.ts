import { describe, expect, it } from "vitest";

import { createDefaultQueryTemplate } from "@salto/core";

import {
  fieldDraftFromQueryField,
  normalizeFieldOrders,
  queryFieldFromDraft,
  switchDraftSource,
  templateDraftFromQueryTemplate,
  validateTemplateDraft,
} from "./template-editor";

describe("template editor", () => {
  it("validates field unions and reports field-level errors", () => {
    const draft = templateDraftFromQueryTemplate(createDefaultQueryTemplate("2026-07-18T00:00:00.000Z"));
    const result = validateTemplateDraft({
      name: " ",
      fields: [{ ...draft.fields[0], instruction: " " }, { ...draft.fields[1], order: 3 }],
    });

    expect(result).toEqual({
      success: false,
      errors: expect.objectContaining({
        name: "模板名称不能为空",
        fields: "字段顺序必须从 0 开始连续排列",
        field: {
          [draft.fields[0].id]: { instruction: "Instruction 不能为空" },
        },
      }),
    });
  });

  it("derives dictionary type and removes incompatible values during confirmed source changes", () => {
    const llmField = fieldDraftFromQueryField(createDefaultQueryTemplate("2026-07-18T00:00:00.000Z").fields[0]);
    const dictionaryField = switchDraftSource({
      ...llmField,
      instruction: "keep this only until confirmation",
    }, "dictionary");

    expect(dictionaryField).toMatchObject({
      source: "dictionary",
      dictionaryField: "phonetic",
      type: "text",
      instruction: "",
    });
    expect(queryFieldFromDraft({ ...dictionaryField, dictionaryField: "synonyms" })).toMatchObject({
      source: "dictionary",
      dictionaryField: "synonyms",
      type: "list",
    });
    expect(normalizeFieldOrders([
      { ...llmField, order: 8 },
      { ...llmField, id: "second", order: 2 },
    ]).map((field) => field.order)).toEqual([0, 1]);
  });

  it("keeps template and field extension data through an edit draft", () => {
    const template = {
      ...createDefaultQueryTemplate("2026-07-18T00:00:00.000Z"),
      customTemplateData: "keep",
      fields: createDefaultQueryTemplate("2026-07-18T00:00:00.000Z").fields.map((field) => ({
        ...field,
        customFieldData: "keep",
      })),
    } as never;
    const draft = templateDraftFromQueryTemplate(template);
    const result = validateTemplateDraft(draft);

    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual(expect.objectContaining({ customTemplateData: "keep" }));
    expect(result.success && result.data.fields[0]).toEqual(expect.objectContaining({ customFieldData: "keep" }));
  });
});
