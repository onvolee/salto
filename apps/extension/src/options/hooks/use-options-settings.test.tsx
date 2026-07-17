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
      hasApiKey: false,
      promptAnalysis: { referencedVariables: [], warnings: [] },
    }),
    saveConfig: vi.fn().mockImplementation(async (config) => ({
      config,
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
    saveSettingsMock.mockResolvedValue();
  });

  it("loads public LLM state without exposing the saved API key", async () => {
    const clients = createClients();
    const { result } = renderHook(() => useOptionsSettings(clients));

    await waitFor(() => expect(result.current.loadState).toBe("ready"));

    expect(result.current.settings.themeMode).toBe("dark");
    expect(result.current.llm).toEqual({
      baseUrl: "https://old.example/v1",
      model: "model-a",
      temperature: "",
      apiKey: "",
      hasApiKey: true,
    });
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
