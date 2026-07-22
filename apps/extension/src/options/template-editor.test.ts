import { describe, expect, it } from "vitest";

import {
  createDefaultQueryTemplate,
  createDefaultTemplateFieldDefinitions,
} from "@salto/core";

import {
  createFieldDraftFromDefinition,
  normalizeFieldOrders,
  templateDraftFromQueryTemplate,
  validateTemplateDraft,
} from "./template-editor";

describe("template editor", () => {
  it("rejects templates without an enabled snapshot", () => {
    const draft = templateDraftFromQueryTemplate(
      createDefaultQueryTemplate("2026-07-18T00:00:00.000Z"),
    );

    const result = validateTemplateDraft({
      ...draft,
      name: " ",
      fields: draft.fields.map((field) => ({ ...field, enabled: false })),
    });

    expect(result).toEqual({
      success: false,
      errors: expect.objectContaining({
        name: "模板名称不能为空",
        fields: "模板至少需要一个启用字段",
      }),
    });
  });

  it("creates multiple independent drafts from one definition and normalizes order", () => {
    const definition = createDefaultTemplateFieldDefinitions(
      "2026-07-18T00:00:00.000Z",
    )[0];
    const first = createFieldDraftFromDefinition(definition, "result-a", 8);
    const second = createFieldDraftFromDefinition(definition, "result-b", 2);

    const normalized = normalizeFieldOrders([first, second]);

    expect(normalized.map(({ id, order }) => ({ id, order }))).toEqual([
      { id: "result-a", order: 0 },
      { id: "result-b", order: 1 },
    ]);
    expect(normalized[0]!.content).toEqual(normalized[1]!.content);
    expect(normalized[0]!.content).not.toBe(normalized[1]!.content);
  });

  it("keeps snapshot content and draft CSS through template validation", () => {
    const template = {
      ...createDefaultQueryTemplate("2026-07-18T00:00:00.000Z"),
      id: "reading",
      customTemplateData: "keep",
    } as never;
    const draft = templateDraftFromQueryTemplate(template);
    const result = validateTemplateDraft({
      ...draft,
      fields: draft.fields.map((field, index) => index === 0
        ? { ...field, keyCss: " color: red; ", valueCss: " font-weight: 700; " }
        : field),
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual(
      expect.objectContaining({ customTemplateData: "keep" }),
    );
    expect(result.success && result.data.fields[0]).toEqual(expect.objectContaining({
      content: draft.fields[0]!.content,
      keyCss: "color: red;",
      valueCss: "font-weight: 700;",
    }));
  });
});
