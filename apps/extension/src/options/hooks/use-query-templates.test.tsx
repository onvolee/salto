// @vitest-environment happy-dom

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  createDefaultQueryTemplate,
  createDefaultTemplateFieldDefinitions,
  type ExtensionRequest,
  type ExtensionResponse,
  type QueryTemplate,
} from "@salto/core";

import type { ExtensionMessageClient } from "../../selection/message-client";
import { useQueryTemplates } from "./use-query-templates";

function createTemplate(): QueryTemplate {
  return {
    ...createDefaultQueryTemplate("2026-07-18T00:00:00.000Z"),
    id: "user-template",
    name: "Reading",
  };
}

function createClient(template: QueryTemplate): ExtensionMessageClient & {
  readonly send: ReturnType<typeof vi.fn>;
} {
  const send = vi.fn(async (request: ExtensionRequest): Promise<ExtensionResponse> => {
    if (request.type === "list-query-templates") {
      return {
        ok: true,
        type: request.type,
        data: { templates: [template], activeQueryTemplateId: template.id },
      };
    }
    if (request.type === "create-query-template") {
      return {
        ok: true,
        type: request.type,
        data: {
          ...request.payload,
          id: "created-template",
          createdAt: "2026-07-23T00:00:00.000Z",
          updatedAt: "2026-07-23T00:00:00.000Z",
        },
      };
    }
    if (request.type === "update-query-template") {
      return { ok: true, type: request.type, data: request.payload.template };
    }
    if (request.type === "copy-query-template") {
      return {
        ok: true,
        type: request.type,
        data: { ...template, id: "copied-template", name: "Reading copy" },
      };
    }
    if (request.type === "delete-query-template") {
      return {
        ok: true,
        type: request.type,
        data: {
          deletedTemplateId: request.payload.templateId,
          activeQueryTemplateId: "system-default",
        },
      };
    }
    return { ok: false, error: { code: "unknown-message", message: "unsupported" } };
  });
  return { send };
}

describe("useQueryTemplates", () => {
  it("adds the same definition as independent snapshots", async () => {
    const template = createTemplate();
    const definition = createDefaultTemplateFieldDefinitions("2026-07-23T00:00:00.000Z")[0];
    const client = createClient(template);
    const { result } = renderHook(() => useQueryTemplates({ client }));
    await waitFor(() => expect(result.current.selectedTemplateId).toBe(template.id));

    act(() => {
      result.current.startNewTemplate();
      result.current.addField(definition);
      result.current.addField(definition);
    });

    expect(result.current.draft?.fields).toHaveLength(2);
    expect(new Set(result.current.draft?.fields.map(({ id }) => id)).size).toBe(2);
    expect(result.current.draft?.fields.map(({ definitionId }) => definitionId))
      .toEqual([definition.id, definition.id]);
  });

  it("avoids result id collisions after reloading an existing template", async () => {
    const definition = createDefaultTemplateFieldDefinitions("2026-07-23T00:00:00.000Z")[0];
    const template = {
      ...createTemplate(),
      fields: [{
        ...createTemplate().fields[0],
        id: "user-template-field-1",
      }],
    };
    const client = createClient(template);
    const createId = vi.fn()
      .mockReturnValueOnce("user-template-field-1")
      .mockReturnValueOnce("globally-unique-result");
    const { result } = renderHook(() => useQueryTemplates({ client, createId }));
    await waitFor(() => expect(result.current.selectedTemplateId).toBe(template.id));

    act(() => result.current.addField(definition));

    expect(result.current.draft?.fields.map(({ id }) => id)).toEqual([
      "user-template-field-1",
      "globally-unique-result",
    ]);
    expect(createId).toHaveBeenCalledTimes(2);
  });

  it("keeps appearance changes in the draft and persists them only on template save", async () => {
    const template = createTemplate();
    const client = createClient(template);
    const { result } = renderHook(() => useQueryTemplates({ client }));
    await waitFor(() => expect(result.current.selectedTemplateId).toBe(template.id));
    const fieldId = template.fields[0].id;

    act(() => result.current.updateField(fieldId, {
      keyCss: "font-weight: 700;",
      valueCss: "color: tomato;",
    }));
    expect(client.send).toHaveBeenCalledTimes(1);

    await act(() => result.current.saveDraft());
    expect(client.send).toHaveBeenLastCalledWith(expect.objectContaining({
      type: "update-query-template",
      payload: {
        template: expect.objectContaining({
          fields: expect.arrayContaining([expect.objectContaining({
            id: fieldId,
            keyCss: "font-weight: 700;",
            valueCss: "color: tomato;",
          })]),
        }),
      },
    }));
  });

  it("rejects a template with no enabled fields and restores saved state on cancel", async () => {
    const template = createTemplate();
    const client = createClient(template);
    const { result } = renderHook(() => useQueryTemplates({ client }));
    await waitFor(() => expect(result.current.selectedTemplateId).toBe(template.id));

    act(() => {
      for (const field of template.fields) result.current.toggleField(field.id);
    });
    let saved = true;
    await act(async () => { saved = await result.current.saveDraft(); });
    expect(saved).toBe(false);
    expect(result.current.errors.fields).toBe("模板至少需要一个启用字段");
    expect(client.send).toHaveBeenCalledTimes(1);

    act(() => result.current.cancelDraft());
    expect(result.current.draft?.fields.every(({ enabled }) => enabled)).toBe(true);
  });

  it("keeps settings callbacks aligned when copy or delete changes selection", async () => {
    const template = createTemplate();
    const client = createClient(template);
    const onActiveTemplateChange = vi.fn();
    const onTemplateDeleted = vi.fn();
    const { result } = renderHook(() => useQueryTemplates({
      client,
      onActiveTemplateChange,
      onTemplateDeleted,
    }));
    await waitFor(() => expect(result.current.selectedTemplateId).toBe(template.id));

    await act(() => result.current.copyTemplate(template.id));
    expect(onActiveTemplateChange).toHaveBeenCalledWith("copied-template");

    await act(() => result.current.deleteTemplate("copied-template"));
    expect(onTemplateDeleted).toHaveBeenCalledWith("copied-template", "system-default");
  });
});
