// @vitest-environment happy-dom

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  createDefaultTemplateFieldDefinitions,
  type ExtensionRequest,
  type ExtensionResponse,
  type TemplateFieldDefinition,
} from "@salto/core";

import type { ExtensionMessageClient } from "../../selection/message-client";
import { useTemplateFieldDefinitions } from "./use-template-field-definitions";

function createClient(initial: readonly TemplateFieldDefinition[]): ExtensionMessageClient & {
  readonly send: ReturnType<typeof vi.fn>;
} {
  let definitions = [...initial];
  const send = vi.fn(async (request: ExtensionRequest): Promise<ExtensionResponse> => {
    if (request.type === "list-template-field-definitions") {
      return { ok: true, type: request.type, data: { definitions } };
    }
    if (request.type === "create-template-field-definition") {
      const definition = {
        ...request.payload,
        id: "created-definition",
        createdAt: "2026-07-23T00:00:00.000Z",
        updatedAt: "2026-07-23T00:00:00.000Z",
      } as TemplateFieldDefinition;
      definitions = [...definitions, definition];
      return { ok: true, type: request.type, data: definition };
    }
    if (request.type === "update-template-field-definition") {
      const current = definitions.find(({ id }) => id === request.payload.definitionId)!;
      const definition = {
        ...request.payload.input,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: "2026-07-23T01:00:00.000Z",
      } as TemplateFieldDefinition;
      definitions = definitions.map((item) => item.id === definition.id ? definition : item);
      return { ok: true, type: request.type, data: definition };
    }
    if (request.type === "delete-template-field-definition") {
      definitions = definitions.filter(({ id }) => id !== request.payload.definitionId);
      return {
        ok: true,
        type: request.type,
        data: { deletedDefinitionId: request.payload.definitionId },
      };
    }
    return { ok: false, error: { code: "unknown-message", message: "unsupported" } };
  });
  return { send };
}

describe("useTemplateFieldDefinitions", () => {
  it("loads and applies definition CRUD responses without mutating snapshots", async () => {
    const initial = createDefaultTemplateFieldDefinitions("2026-07-23T00:00:00.000Z");
    const client = createClient(initial);
    const { result } = renderHook(() => useTemplateFieldDefinitions({ client }));

    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(result.current.definitions).toHaveLength(2);

    await act(() => result.current.createDefinition({
      label: "Summary",
      description: "Short explanation",
      source: "llm",
      type: "text",
      instruction: "Summarize {{selection}}.",
    }));
    expect(result.current.definitions.at(-1)?.id).toBe("created-definition");

    await act(() => result.current.updateDefinition("created-definition", {
      label: "Meaning",
      source: "dictionary",
      dictionaryField: "meaning",
      type: "text",
    }));
    expect(result.current.definitions.at(-1)).toMatchObject({
      label: "Meaning",
      source: "dictionary",
    });

    await act(() => result.current.deleteDefinition("created-definition"));
    expect(result.current.definitions.some(({ id }) => id === "created-definition")).toBe(false);
  });
});
