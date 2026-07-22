import {
  createDefaultQueryTemplate,
  type ExtensionRequest,
  type ExtensionResponse,
  type QueryTemplate,
  type TemplateFieldDefinition,
} from "@salto/core";
import { useEffect, useState } from "react";

import { browserMessageClient, type ExtensionMessageClient } from "../../selection/message-client";
import {
  createNewTemplateDraft,
  createFieldDraftFromDefinition,
  normalizeFieldOrders,
  templateDraftFromQueryTemplate,
  validateTemplateDraft,
  type TemplateDraft,
  type TemplateFieldDraft,
  type TemplateValidationErrors,
} from "../template-editor";

type SuccessResponse = Extract<ExtensionResponse, { readonly ok: true }>;
type TemplateListData = Extract<SuccessResponse, { readonly type: "list-query-templates" }>["data"];
type DeleteTemplateData = Extract<SuccessResponse, { readonly type: "delete-query-template" }>["data"];

type UseQueryTemplatesDependencies = {
  readonly client?: ExtensionMessageClient;
  readonly createId?: () => string;
  readonly now?: () => string;
  readonly onActiveTemplateChange?: (templateId: string) => void;
  readonly onTemplateDeleted?: (deletedTemplateId: string, fallbackTemplateId: string) => void;
};

export type TemplateEditorStatus = "idle" | "loading" | "saving" | "error";

function fallbackTemplateClient(): ExtensionMessageClient {
  const template = createDefaultQueryTemplate("2026-07-18T00:00:00.000Z");
  return {
    async send(request: ExtensionRequest): Promise<ExtensionResponse> {
      if (request.type === "list-query-templates") {
        return {
          ok: true,
          type: request.type,
          data: { templates: [template], activeQueryTemplateId: template.id },
        };
      }
      return {
        ok: false,
        error: { code: "unknown-message", message: "模板服务不可用" },
      };
    },
  };
}

const FALLBACK_TEMPLATE_CLIENT = fallbackTemplateClient();

function getDefaultClient(): ExtensionMessageClient {
  return typeof browser === "undefined" ? FALLBACK_TEMPLATE_CLIENT : browserMessageClient;
}

function responseError(response: ExtensionResponse): Error {
  return response.ok ? new Error("Unexpected template response") : new Error(response.error.message);
}

function successData(response: ExtensionResponse, type: "list-query-templates"): TemplateListData;
function successData(response: ExtensionResponse, type: "create-query-template" | "copy-query-template" | "update-query-template"): QueryTemplate;
function successData(response: ExtensionResponse, type: "delete-query-template"): DeleteTemplateData;
function successData(
  response: ExtensionResponse,
  type: SuccessResponse["type"],
): SuccessResponse["data"] {
  if (!response.ok || response.type !== type) throw responseError(response);
  return response.data;
}

function defaultCreateId(): string {
  return crypto.randomUUID();
}

export function useQueryTemplates(dependencies: UseQueryTemplatesDependencies = {}) {
  const client = dependencies.client ?? getDefaultClient();
  const createId = dependencies.createId ?? defaultCreateId;
  const now = dependencies.now ?? (() => new Date().toISOString());
  const [templates, setTemplates] = useState<readonly QueryTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState("system-default");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [errors, setErrors] = useState<TemplateValidationErrors>({ field: {} });
  const [status, setStatus] = useState<TemplateEditorStatus>("loading");
  const [message, setMessage] = useState<string | null>(null);

  const applyList = (data: TemplateListData, preferredId?: string) => {
    setTemplates(data.templates);
    setActiveTemplateId(data.activeQueryTemplateId);
    const nextId = preferredId
      ?? selectedTemplateId
      ?? data.activeQueryTemplateId
      ?? data.templates[0]?.id;
    const nextTemplate = data.templates.find((template) => template.id === nextId)
      ?? data.templates[0];
    setSelectedTemplateId(nextTemplate?.id ?? null);
    setDraft(nextTemplate ? templateDraftFromQueryTemplate(nextTemplate) : null);
  };

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    void client.send({ type: "list-query-templates" }).then((response) => {
      if (cancelled) return;
      applyList(successData(response, "list-query-templates"));
      setStatus("idle");
    }).catch((error: unknown) => {
      if (cancelled) return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "无法加载模板");
    });
    return () => { cancelled = true; };
  }, [client]);

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const isSystemTemplate = selectedTemplate?.id === "system-default";

  const updateDraft = (update: (current: TemplateDraft) => TemplateDraft) => {
    setDraft((current) => current ? update(current) : current);
    setErrors({ field: {} });
    setMessage(null);
    setStatus("idle");
  };

  const selectTemplate = (id: string) => {
    const template = templates.find((candidate) => candidate.id === id);
    if (!template) return;
    setSelectedTemplateId(id);
    setDraft(templateDraftFromQueryTemplate(template));
    setErrors({ field: {} });
    setMessage(null);
  };

  const startNewTemplate = () => {
    setSelectedTemplateId(null);
    setDraft(createNewTemplateDraft(now()));
    setErrors({ field: {} });
    setMessage(null);
  };

  const saveDraft = async (): Promise<boolean> => {
    if (!draft || isSystemTemplate) return false;
    const result = validateTemplateDraft(draft);
    if (!result.success) {
      setErrors(result.errors);
      setStatus("error");
      setMessage("请修正模板字段后再保存");
      return false;
    }

    setStatus("saving");
    try {
      const response = draft.id === "new"
        ? await client.send({ type: "create-query-template", payload: result.data })
        : await client.send({
          type: "update-query-template",
          payload: {
            template: {
              ...draft.extensions,
              id: draft.id,
              name: result.data.name,
              fields: result.data.fields,
              createdAt: draft.createdAt,
              updatedAt: draft.updatedAt,
            },
          },
        });
      const saved = successData(response, draft.id === "new" ? "create-query-template" : "update-query-template");
      setTemplates((current) => current.some((template) => template.id === saved.id)
        ? current.map((template) => template.id === saved.id ? saved : template)
        : [...current, saved]);
      setSelectedTemplateId(saved.id);
      setDraft(templateDraftFromQueryTemplate(saved));
      setErrors({ field: {} });
      setStatus("idle");
      setMessage("模板已保存");
      if (draft.id === "new") {
        dependencies.onActiveTemplateChange?.(saved.id);
      }
      return true;
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "模板保存失败");
      return false;
    }
  };

  const cancelDraft = () => {
    const template = selectedTemplateId
      ? templates.find((candidate) => candidate.id === selectedTemplateId)
      : templates.find((candidate) => candidate.id === activeTemplateId);
    setSelectedTemplateId(template?.id ?? null);
    setDraft(template ? templateDraftFromQueryTemplate(template) : null);
    setErrors({ field: {} });
    setMessage(null);
    setStatus("idle");
  };

  const addField = (definition: TemplateFieldDefinition) => updateDraft((current) => {
    const index = current.fields.length;
    const existingIds = new Set(current.fields.map(({ id }) => id));
    let id = createId();
    while (!id.trim() || existingIds.has(id)) id = createId();
    return {
      ...current,
      fields: [...current.fields, createFieldDraftFromDefinition(definition, id, index)],
    };
  });

  const updateField = (
    id: string,
    update: Partial<Pick<TemplateFieldDraft, "enabled" | "keyCss" | "valueCss">>,
  ) => {
    updateDraft((current) => ({
      ...current,
      fields: current.fields.map((field) => field.id === id ? { ...field, ...update } : field),
    }));
  };

  const removeField = (id: string) => updateDraft((current) => ({
    ...current,
    fields: normalizeFieldOrders(current.fields.filter((field) => field.id !== id)),
  }));

  const toggleField = (id: string) => updateDraft((current) => ({
    ...current,
    fields: current.fields.map((field) => field.id === id
      ? { ...field, enabled: !field.enabled }
      : field),
  }));

  const moveField = (from: number, to: number) => updateDraft((current) => {
    if (from < 0 || to < 0 || from >= current.fields.length || to >= current.fields.length) return current;
    const next = [...current.fields];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return { ...current, fields: normalizeFieldOrders(next) };
  });

  const copyTemplate = async (id: string) => {
    setStatus("saving");
    try {
      const copied = successData(await client.send({
        type: "copy-query-template",
        payload: { templateId: id },
      }), "copy-query-template");
      setTemplates((current) => [...current, copied]);
      setSelectedTemplateId(copied.id);
      setDraft(templateDraftFromQueryTemplate(copied));
      setStatus("idle");
      setMessage("模板已复制");
      dependencies.onActiveTemplateChange?.(copied.id);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "模板复制失败");
    }
  };

  const deleteTemplate = async (id: string) => {
    if (id === "system-default") return;
    setStatus("saving");
    try {
      const data = successData(await client.send({
        type: "delete-query-template",
        payload: { templateId: id },
      }), "delete-query-template");
      const nextTemplates = templates.filter((template) => template.id !== id);
      setTemplates(nextTemplates);
      setActiveTemplateId(data.activeQueryTemplateId);
      const next = nextTemplates.find((template) => template.id === data.activeQueryTemplateId)
        ?? nextTemplates[0];
      setSelectedTemplateId(next?.id ?? null);
      setDraft(next ? templateDraftFromQueryTemplate(next) : null);
      setStatus("idle");
      setMessage("模板已删除");
      dependencies.onTemplateDeleted?.(id, data.activeQueryTemplateId);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "模板删除失败");
    }
  };

  return {
    activeTemplateId,
    addField,
    cancelDraft,
    copyTemplate,
    deleteTemplate,
    draft,
    errors,
    isSystemTemplate,
    message,
    moveField,
    removeField,
    saveDraft,
    selectTemplate,
    selectedTemplateId,
    startNewTemplate,
    status,
    templates,
    toggleField,
    updateDraft,
    updateField,
  };
}
