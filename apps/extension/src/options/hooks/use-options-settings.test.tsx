// @vitest-environment happy-dom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from "salto-src/theme/theme-settings";

import type {
  LlmPermissionClient,
  OptionsLlmClient,
} from "../llm-client";
import { useOptionsSettings } from "./use-options-settings";

vi.mock("salto-src/theme/theme-settings", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("salto-src/theme/theme-settings")
  >();
  return {
    ...actual,
    loadSettings: vi.fn(),
    saveSettings: vi.fn(),
  };
});

const loadSettingsMock = vi.mocked(loadSettings);
const saveSettingsMock = vi.mocked(saveSettings);

function createClients(configured = true) {
  const llmClient: OptionsLlmClient = {
    getConfig: vi.fn().mockResolvedValue(configured ? {
      config: {
        provider: "openai-compatible",
        baseUrl: "https://old.example/v1",
        model: "model-a",
      },
      hasApiKey: true,
      promptAnalysis: { referencedVariables: [], warnings: [] },
    } : {
      config: undefined,
      hasApiKey: false,
      promptAnalysis: { referencedVariables: [], warnings: [] },
    }),
    saveConfig: vi.fn().mockImplementation(async (config) => ({
      config: { ...config, enableThinking: config.enableThinking ?? false },
      hasApiKey: true,
    })),
    testConnection: vi.fn().mockResolvedValue(undefined),
  };
  const permissionClient: LlmPermissionClient = {
    request: vi.fn().mockResolvedValue(true),
    remove: vi.fn().mockResolvedValue(true),
  };
  return { llmClient, permissionClient };
}

describe("useOptionsSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadSettingsMock.mockResolvedValue({ ...DEFAULT_SETTINGS, themeMode: "dark" });
    saveSettingsMock.mockImplementation(async (settings) => settings);
  });

  it("loads public LLM state without exposing the saved API key", async () => {
    const clients = createClients();
    const { result } = renderHook(() => useOptionsSettings(clients));

    await waitFor(() => {
      expect(result.current.loadState).toBe("ready");
      expect(result.current.settings.themeMode).toBe("dark");
    });

    expect(result.current.llm).toEqual({
      baseUrl: "https://old.example/v1",
      model: "model-a",
      temperature: "",
      apiKey: "",
      hasApiKey: true,
      enableThinking: false,
    });
    expect(clients.permissionClient.request).not.toHaveBeenCalled();
  });

  it("keeps the active template in the page draft until the global save", async () => {
    const clients = createClients();
    const { result } = renderHook(() => useOptionsSettings(clients));
    await waitFor(() => expect(result.current.loadState).toBe("ready"));

    act(() => result.current.updateSetting("activeQueryTemplateId", "reading-template"));

    expect(result.current.saveStatus).toBe("dirty");
    expect(saveSettingsMock).not.toHaveBeenCalled();

    await act(() => result.current.save());

    expect(saveSettingsMock).toHaveBeenCalledWith(expect.objectContaining({
      activeQueryTemplateId: "reading-template",
      activeDictionaryProvider: "youdao-web",
    }));
    expect(result.current.saveStatus).toBe("saved");
  });

  it("requests the exact origin before saving normalized configuration", async () => {
    const clients = createClients();
    const confirmRemoveOrigin = vi.fn().mockReturnValue(false);
    const { result } = renderHook(() => useOptionsSettings({
      ...clients,
      confirmRemoveOrigin,
    }));
    await waitFor(() => expect(result.current.loadState).toBe("ready"));

    act(() => result.current.updateLlm("baseUrl", "https://new.example/v1/"));
    act(() => result.current.updateLlm("model", " model-b "));
    act(() => result.current.updateLlm("apiKey", " replacement-secret "));
    await act(() => result.current.save());

    expect(clients.permissionClient.request).toHaveBeenCalledWith("https://new.example/*");
    expect(clients.llmClient.saveConfig).toHaveBeenCalledWith({
      provider: "openai-compatible",
      baseUrl: "https://new.example/v1",
      model: "model-b",
      enableThinking: false,
    }, "replacement-secret");
    expect(result.current.llm.apiKey).toBe("");
    expect(result.current.llm.hasApiKey).toBe(true);
    expect(result.current.saveStatus).toBe("saved");
  });

  it("does not persist or test after host permission is denied", async () => {
    const clients = createClients(false);
    vi.mocked(clients.permissionClient.request).mockResolvedValue(false);
    const { result } = renderHook(() => useOptionsSettings(clients));
    await waitFor(() => expect(result.current.loadState).toBe("ready"));
    act(() => result.current.updateLlm("baseUrl", "https://api.example/v1"));
    act(() => result.current.updateLlm("model", "model-a"));
    act(() => result.current.updateLlm("apiKey", "secret-a"));

    await act(() => result.current.testConnection());

    expect(clients.llmClient.saveConfig).not.toHaveBeenCalled();
    expect(clients.llmClient.testConnection).not.toHaveBeenCalled();
    expect(result.current.connectionStatus).toEqual({
      status: "error",
      message: "未授予服务地址访问权限",
    });

    vi.mocked(clients.permissionClient.request).mockResolvedValue(true);
    await act(() => result.current.testConnection());

    expect(clients.llmClient.saveConfig).toHaveBeenCalledOnce();
    expect(clients.llmClient.testConnection).toHaveBeenCalledOnce();
    expect(result.current.connectionStatus).toEqual({
      status: "success",
      message: "连接成功",
    });
  });

  it("keeps a failed settings save retryable", async () => {
    const clients = createClients();
    saveSettingsMock.mockRejectedValueOnce(new Error("IndexedDB unavailable"));
    const { result } = renderHook(() => useOptionsSettings(clients));
    await waitFor(() => expect(result.current.loadState).toBe("ready"));

    act(() => result.current.updateSetting("highlightEnabled", false));
    await act(() => result.current.save());

    expect(result.current.settings.highlightEnabled).toBe(false);
    expect(result.current.saveStatus).toBe("error");

    await act(() => result.current.save());
    expect(result.current.saveStatus).toBe("saved");
  });

  it("validates the extension settings form before persistence", async () => {
    const clients = createClients();
    const { result } = renderHook(() => useOptionsSettings(clients));
    await waitFor(() => expect(result.current.loadState).toBe("ready"));

    act(() => result.current.updateSetting("targetLanguage", ""));
    act(() => result.current.updateLlm("model", "replacement-model"));
    await act(() => result.current.save());

    expect(saveSettingsMock).not.toHaveBeenCalled();
    expect(clients.permissionClient.request).not.toHaveBeenCalled();
    expect(clients.llmClient.saveConfig).not.toHaveBeenCalled();
    expect(result.current.saveStatus).toBe("error");
  });

  it("re-requests a revoked origin permission before testing saved configuration", async () => {
    const clients = createClients();
    vi.mocked(clients.permissionClient.request).mockResolvedValue(false);
    const { result } = renderHook(() => useOptionsSettings(clients));
    await waitFor(() => expect(result.current.loadState).toBe("ready"));

    await act(() => result.current.testConnection());

    expect(clients.permissionClient.request).toHaveBeenCalledWith("https://old.example/*");
    expect(clients.llmClient.testConnection).not.toHaveBeenCalled();
    expect(result.current.connectionStatus).toEqual({
      status: "error",
      message: "未授予服务地址访问权限",
    });
  });

  it("saves before testing and can remove an obsolete origin after confirmation", async () => {
    const clients = createClients();
    const confirmRemoveOrigin = vi.fn().mockReturnValue(true);
    const { result } = renderHook(() => useOptionsSettings({
      ...clients,
      confirmRemoveOrigin,
    }));
    await waitFor(() => expect(result.current.loadState).toBe("ready"));
    act(() => result.current.updateLlm("baseUrl", "https://new.example/v1"));

    await act(() => result.current.testConnection());

    expect(clients.llmClient.saveConfig).toHaveBeenCalledBefore(
      vi.mocked(clients.llmClient.testConnection),
    );
    expect(clients.llmClient.testConnection).toHaveBeenCalledOnce();
    expect(confirmRemoveOrigin).toHaveBeenCalledWith("https://old.example/*");
    expect(clients.permissionClient.remove).toHaveBeenCalledWith("https://old.example/*");
    expect(result.current.connectionStatus).toEqual({
      status: "success",
      message: "连接成功",
    });
  });
});
