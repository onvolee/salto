import {
  normalizeLlmPublicConfig,
  type LlmPublicConfig,
  type PromptTemplateAnalysis,
} from "@salto/core";
import { useForm, useStore } from "@tanstack/react-form";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type SaltoSettings,
} from "salto-src/theme/theme-settings";

import {
  browserLlmPermissionClient,
  browserOptionsLlmClient,
  OptionsLlmError,
  type LlmPermissionClient,
  type OptionsLlmClient,
  type OptionsLlmErrorCode,
} from "../llm-client";
import type { SaveStatus } from "../types";

export type LlmDraft = {
  readonly baseUrl: string;
  readonly model: string;
  readonly temperature: string;
  readonly apiKey: string;
  readonly hasApiKey: boolean;
  readonly enableThinking: boolean;
};

export type ConnectionStatus =
  | { readonly status: "idle"; readonly message: "" }
  | { readonly status: "testing"; readonly message: string }
  | { readonly status: "success"; readonly message: string }
  | { readonly status: "error"; readonly message: string };

type Dependencies = {
  readonly llmClient?: OptionsLlmClient;
  readonly permissionClient?: LlmPermissionClient;
  readonly confirmRemoveOrigin?: (permissionOrigin: string) => boolean;
};

const EMPTY_LLM_DRAFT: LlmDraft = {
  baseUrl: "https://api.openai.com/v1",
  model: "",
  temperature: "",
  apiKey: "",
  hasApiKey: false,
  enableThinking: false,
};

const EMPTY_PROMPT_ANALYSIS: PromptTemplateAnalysis = {
  referencedVariables: [],
  warnings: [],
};

const EXTENSION_SETTINGS_SCHEMA = z.object({
  activeQueryTemplateId: z.string().trim().min(1),
  targetLanguage: z.string().trim().min(1),
  highlightEnabled: z.boolean(),
  highlightSameWords: z.boolean(),
  themeMode: z.enum(["system", "light", "dark"]),
  activeDictionaryProvider: z.literal("youdao-web"),
  panelWidth: z.number(),
  panelHeight: z.number(),
}).strict();

function draftFromConfig(
  config: LlmPublicConfig | undefined,
  hasApiKey: boolean,
): LlmDraft {
  return {
    baseUrl: config?.baseUrl ?? EMPTY_LLM_DRAFT.baseUrl,
    model: config?.model ?? "",
    temperature: config?.temperature?.toString() ?? "",
    apiKey: "",
    hasApiKey,
    enableThinking: config?.enableThinking ?? false,
  };
}

function connectionErrorMessage(error: unknown): string {
  if (error instanceof OptionsLlmError) {
    const messages: Partial<Record<OptionsLlmErrorCode, string>> = {
      authentication: "认证失败，请检查 API Key",
      "model-not-found": "未找到配置的模型",
      network: "无法连接服务地址",
      "permission-denied": "未授予服务地址访问权限",
      provider: "服务暂时不可用",
      "rate-limit": "请求过于频繁，请稍后重试",
      timeout: "连接测试超时",
    };
    return messages[error.code] ?? error.message;
  }
  return error instanceof Error ? error.message : "连接测试失败";
}

export function useOptionsSettings(dependencies: Dependencies = {}) {
  const llmClient = dependencies.llmClient ?? browserOptionsLlmClient;
  const permissionClient = dependencies.permissionClient ?? browserLlmPermissionClient;
  const confirmRemoveOrigin = dependencies.confirmRemoveOrigin
    ?? ((permissionOrigin: string) => window.confirm(
      `服务地址已更换。是否移除旧地址 ${permissionOrigin} 的访问权限？`,
    ));
  const settingsDefaultsRef = useRef<SaltoSettings>(DEFAULT_SETTINGS);
  const settingsForm = useForm({
    defaultValues: settingsDefaultsRef.current,
    validators: { onChange: EXTENSION_SETTINGS_SCHEMA },
    async onSubmit({ value }) {
      await saveSettings(value);
    },
  });
  const settings = useStore(settingsForm.store, (state) => state.values);
  const [llm, setLlm] = useState<LlmDraft>(EMPTY_LLM_DRAFT);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [promptAnalysis, setPromptAnalysis] = useState(EMPTY_PROMPT_ANALYSIS);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: "idle",
    message: "",
  });
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("synced");
  const revisionRef = useRef(0);
  const llmDirtyRef = useRef(false);
  const storedConfigRef = useRef<LlmPublicConfig | undefined>(undefined);

  const replaceSettings = (next: SaltoSettings) => {
    settingsDefaultsRef.current = next;
    settingsForm.setFieldValue("activeQueryTemplateId", next.activeQueryTemplateId);
    settingsForm.setFieldValue("targetLanguage", next.targetLanguage);
    settingsForm.setFieldValue("highlightEnabled", next.highlightEnabled);
    settingsForm.setFieldValue("themeMode", next.themeMode);
    settingsForm.setFieldValue("activeDictionaryProvider", next.activeDictionaryProvider);
    settingsForm.reset(next);
  };

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadSettings(), llmClient.getConfig()])
      .then(([storedSettings, llmState]) => {
        if (cancelled) return;
        replaceSettings(storedSettings);
        storedConfigRef.current = llmState.config;
        setLlm(draftFromConfig(llmState.config, llmState.hasApiKey));
        setPromptAnalysis(llmState.promptAnalysis);
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [llmClient, settingsForm]);

  const updateSetting = <K extends keyof SaltoSettings>(
    key: K,
    value: SaltoSettings[K],
  ) => {
    revisionRef.current += 1;
    settingsForm.setFieldValue(key, (current) => value as typeof current);
    setSaveStatus("dirty");
  };

  const updateLlm = <K extends keyof Pick<LlmDraft, "baseUrl" | "model" | "temperature" | "apiKey" | "enableThinking">>(
    key: K,
    value: LlmDraft[K],
  ) => {
    revisionRef.current += 1;
    llmDirtyRef.current = true;
    setLlm((current) => ({ ...current, [key]: value }));
    setLlmError(null);
    setConnectionStatus({ status: "idle", message: "" });
    setSaveStatus("dirty");
  };

  const requireOriginPermission = async (permissionOrigin: string): Promise<void> => {
    if (!await permissionClient.request(permissionOrigin)) {
      throw new OptionsLlmError(
        "permission-denied",
        "未授予服务地址访问权限",
      );
    }
  };

  const persistLlm = async (): Promise<void> => {
    let temperature: number | undefined;
    if (llm.temperature.trim()) {
      temperature = Number(llm.temperature);
    }
    let normalized;
    try {
      normalized = normalizeLlmPublicConfig({
        provider: "openai-compatible",
        baseUrl: llm.baseUrl,
        model: llm.model,
        ...(temperature === undefined ? {} : { temperature }),
        enableThinking: llm.enableThinking,
      });
      if (!llm.hasApiKey && !llm.apiKey.trim()) {
        throw new OptionsLlmError("missing-api-key", "首次配置需要填写 API Key");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 服务配置无效";
      setLlmError(message);
      throw error;
    }

    try {
      await requireOriginPermission(normalized.permissionOrigin);
    } catch (error) {
      const message = error instanceof Error ? error.message : "未授予服务地址访问权限";
      setLlmError(message);
      throw error;
    }

    const previousConfig = storedConfigRef.current;
    const apiKey = llm.apiKey.trim();
    const state = await llmClient.saveConfig(
      normalized.config,
      apiKey || undefined,
    );
    storedConfigRef.current = state.config;
    llmDirtyRef.current = false;
    setLlm(draftFromConfig(state.config, state.hasApiKey));
    setLlmError(null);

    if (previousConfig) {
      const previousOrigin = normalizeLlmPublicConfig(previousConfig).permissionOrigin;
      if (
        previousOrigin !== normalized.permissionOrigin
        && confirmRemoveOrigin(previousOrigin)
      ) {
        await permissionClient.remove(previousOrigin);
      }
    }
  };

  const save = async () => {
    const savedRevision = revisionRef.current;
    setSaveStatus("saving");
    try {
      await settingsForm.validate("submit");
      if (!settingsForm.state.isValid) {
        throw new Error("Extension settings are invalid");
      }
      if (llmDirtyRef.current) {
        await persistLlm();
      }
      await settingsForm.handleSubmit();
      if (!settingsForm.state.isSubmitSuccessful) {
        throw new Error("Extension settings are invalid");
      }
      settingsDefaultsRef.current = settingsForm.state.values;
      settingsForm.reset(settingsForm.state.values);
      setSaveStatus(revisionRef.current === savedRevision ? "saved" : "dirty");
    } catch {
      setSaveStatus("error");
    }
  };

  const testConnection = async () => {
    setConnectionStatus({ status: "testing", message: "正在测试连接..." });
    try {
      await persistLlm();
      await llmClient.testConnection();
      setConnectionStatus({ status: "success", message: "连接成功" });
    } catch (error) {
      setConnectionStatus({
        status: "error",
        message: connectionErrorMessage(error),
      });
    }
  };

  return {
    connectionStatus,
    llm,
    llmError,
    loadState,
    promptAnalysis,
    save,
    saveStatus,
    settings,
    testConnection,
    updateLlm,
    updateSetting,
  };
}
