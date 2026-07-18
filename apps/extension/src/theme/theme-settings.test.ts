import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  subscribeToSettings,
} from "./theme-settings";

type RuntimeListener = (message: unknown) => void;

function stubRuntime() {
  const listeners = new Set<RuntimeListener>();
  const sendMessage = vi.fn(async (request: { readonly type: string; readonly payload?: unknown }) => {
    if (request.type === "get-extension-settings") {
      return {
        ok: true,
        type: request.type,
        data: { ...DEFAULT_SETTINGS, themeMode: "dark" },
      };
    }
    if (request.type === "save-extension-settings") {
      return { ok: true, type: request.type, data: request.payload };
    }
    return { ok: false, error: { code: "unknown-message", message: "Unknown" } };
  });
  const addListener = vi.fn((listener: RuntimeListener) => listeners.add(listener));
  const removeListener = vi.fn((listener: RuntimeListener) => listeners.delete(listener));
  vi.stubGlobal("browser", {
    runtime: {
      sendMessage,
      onMessage: { addListener, removeListener },
    },
  });
  return { addListener, listeners, removeListener, sendMessage };
}

describe("extension settings client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads and saves only through typed background messages", async () => {
    const runtime = stubRuntime();
    const saved = { ...DEFAULT_SETTINGS, targetLanguage: "en-US", themeMode: "light" as const };

    await expect(loadSettings()).resolves.toEqual({ ...DEFAULT_SETTINGS, themeMode: "dark" });
    await expect(saveSettings(saved)).resolves.toEqual(saved);

    expect(runtime.sendMessage).toHaveBeenNthCalledWith(1, { type: "get-extension-settings" });
    expect(runtime.sendMessage).toHaveBeenNthCalledWith(2, {
      type: "save-extension-settings",
      payload: saved,
    });
  });

  it("subscribes to valid public change notifications and removes the same listener", () => {
    const runtime = stubRuntime();
    const onChange = vi.fn();
    const unsubscribe = subscribeToSettings(onChange);
    const next = { ...DEFAULT_SETTINGS, highlightEnabled: false };

    for (const listener of runtime.listeners) {
      listener({ type: "extension-settings-changed", payload: next });
      listener({ type: "extension-settings-changed", payload: { ...next, apiKey: "secret" } });
      listener({
        type: "extension-settings-changed",
        payload: { ...next, legacySettingsMigrationCompleted: true },
      });
      listener({ type: "other-event", payload: next });
    }

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(next);
    unsubscribe();
    expect(runtime.removeListener).toHaveBeenCalledWith(runtime.addListener.mock.calls[0][0]);
    expect(runtime.listeners.size).toBe(0);
  });
});
