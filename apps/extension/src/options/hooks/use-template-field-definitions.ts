import {
  createDefaultTemplateFieldDefinitions,
  type ExtensionRequest,
  type ExtensionResponse,
  type TemplateFieldDefinition,
  type TemplateFieldDefinitionInput,
} from "@salto/core";
import { useEffect, useState } from "react";

import {
  browserMessageClient,
  type ExtensionMessageClient,
} from "../../selection/message-client";

type Dependencies = {
  readonly client?: ExtensionMessageClient;
};

type Status = "loading" | "idle" | "saving" | "error";

function fallbackClient(): ExtensionMessageClient {
  const definitions = createDefaultTemplateFieldDefinitions(
    "2026-07-23T00:00:00.000Z",
  );
  return {
    async send(request: ExtensionRequest): Promise<ExtensionResponse> {
      if (request.type === "list-template-field-definitions") {
        return {
          ok: true,
          type: request.type,
          data: { definitions },
        };
      }
      return {
        ok: false,
        error: { code: "unknown-message", message: "字段定义服务不可用" },
      };
    },
  };
}

const FALLBACK_CLIENT = fallbackClient();

function getDefaultClient(): ExtensionMessageClient {
  return typeof browser === "undefined" ? FALLBACK_CLIENT : browserMessageClient;
}

function unwrapDefinition(
  response: ExtensionResponse,
  type: "create-template-field-definition" | "update-template-field-definition",
): TemplateFieldDefinition {
  if (!response.ok || response.type !== type) {
    throw new Error(response.ok ? "字段定义响应无效" : response.error.message);
  }
  return response.data;
}

export function useTemplateFieldDefinitions(dependencies: Dependencies = {}) {
  const client = dependencies.client ?? getDefaultClient();
  const [definitions, setDefinitions] = useState<readonly TemplateFieldDefinition[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    void client.send({ type: "list-template-field-definitions" }).then((response) => {
      if (cancelled) return;
      if (!response.ok || response.type !== "list-template-field-definitions") {
        throw new Error(response.ok ? "字段定义响应无效" : response.error.message);
      }
      setDefinitions(response.data.definitions);
      setStatus("idle");
    }).catch((error: unknown) => {
      if (cancelled) return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "无法加载字段定义");
    });
    return () => { cancelled = true; };
  }, [client]);

  const runMutation = async <T,>(operation: () => Promise<T>): Promise<T | null> => {
    setStatus("saving");
    setMessage(null);
    try {
      const result = await operation();
      setStatus("idle");
      return result;
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "字段定义操作失败");
      return null;
    }
  };

  const createDefinition = (input: TemplateFieldDefinitionInput) => runMutation(async () => {
    const created = unwrapDefinition(
      await client.send({ type: "create-template-field-definition", payload: input }),
      "create-template-field-definition",
    );
    setDefinitions((current) => [...current, created]);
    return created;
  });

  const updateDefinition = (definitionId: string, input: TemplateFieldDefinitionInput) =>
    runMutation(async () => {
      const updated = unwrapDefinition(await client.send({
        type: "update-template-field-definition",
        payload: { definitionId, input },
      }), "update-template-field-definition");
      setDefinitions((current) => current.map((definition) =>
        definition.id === updated.id ? updated : definition));
      return updated;
    });

  const deleteDefinition = (definitionId: string) => runMutation(async () => {
    const response = await client.send({
      type: "delete-template-field-definition",
      payload: { definitionId },
    });
    if (!response.ok || response.type !== "delete-template-field-definition") {
      throw new Error(response.ok ? "字段定义响应无效" : response.error.message);
    }
    setDefinitions((current) => current.filter(({ id }) => id !== definitionId));
    return true;
  });

  return {
    createDefinition,
    definitions,
    deleteDefinition,
    message,
    status,
    updateDefinition,
  };
}
