// @vitest-environment happy-dom

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  createDefaultQueryTemplate,
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
    fields: createDefaultQueryTemplate("2026-07-18T00:00:00.000Z").fields,
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
    if (request.type === "update-query-template") {
      return { ok: true, type: request.type, data: request.payload.template };
    }
    return { ok: false, error: { code: "unknown-message", message: "unsupported" } };
  });
  return { send };
}

describe("useQueryTemplates", () => {
  it("keeps source-specific values when switching is cancelled and clears them after confirmation", async () => {
    const template = createTemplate();
    const client = createClient(template);
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { result } = renderHook(() => useQueryTemplates({ client, confirm }));

    await waitFor(() => expect(result.current.selectedTemplateId).toBe(template.id));
    const fieldId = template.fields[0].id;
    const instruction = result.current.draft?.fields[0].instruction;

    act(() => { result.current.changeFieldSource(fieldId, "dictionary"); });
    expect(result.current.draft?.fields[0].source).toBe("llm");
    expect(result.current.draft?.fields[0].instruction).toBe(instruction);

    act(() => { result.current.changeFieldSource(fieldId, "dictionary"); });
    expect(result.current.draft?.fields[0]).toMatchObject({
      source: "dictionary",
      dictionaryField: "phonetic",
      instruction: "",
      type: "text",
    });
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it("blocks invalid saves, normalizes order, and restores the selected template on cancel", async () => {
    const template = createTemplate();
    const client = createClient(template);
    const { result } = renderHook(() => useQueryTemplates({ client }));
    await waitFor(() => expect(result.current.selectedTemplateId).toBe(template.id));

    act(() => {
      result.current.updateField(template.fields[0].id, { instruction: " " });
      result.current.moveField(0, 1);
    });
    let saved = true;
    await act(async () => { saved = await result.current.saveDraft(); });
    expect(saved).toBe(false);
    expect(client.send).toHaveBeenCalledTimes(1);
    expect(result.current.errors.field[template.fields[0].id]).toEqual({
      instruction: "Instruction 不能为空",
    });

    act(() => { result.current.cancelDraft(); });
    expect(result.current.draft?.fields.map((field) => field.order)).toEqual([0, 1]);
    expect(result.current.draft?.fields[0].instruction).toBe(template.fields[0].instruction);
  });

  it("saves unknown and malformed prompt variables as non-blocking warnings", async () => {
    const template = createTemplate();
    const client = createClient(template);
    const { result } = renderHook(() => useQueryTemplates({ client }));
    await waitFor(() => expect(result.current.selectedTemplateId).toBe(template.id));

    act(() => {
      result.current.updateField(template.fields[0].id, {
        instruction: "Use {{pageText}} and {{ }}.",
      });
    });

    let saved = false;
    await act(async () => { saved = await result.current.saveDraft(); });

    expect(saved).toBe(true);
    expect(result.current.message).toBe("模板已保存");
    expect(client.send).toHaveBeenLastCalledWith(expect.objectContaining({
      type: "update-query-template",
      payload: expect.objectContaining({
        template: expect.objectContaining({
          fields: expect.arrayContaining([
            expect.objectContaining({ instruction: "Use {{pageText}} and {{ }}." }),
          ]),
        }),
      }),
    }));
  });
});
