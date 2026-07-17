// @vitest-environment happy-dom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from "salto-src/theme/theme-settings";

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

describe("useOptionsSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadSettingsMock.mockResolvedValue({
      ...DEFAULT_SETTINGS,
      themeMode: "dark",
    });
    saveSettingsMock.mockResolvedValue();
  });

  it("loads, updates, and saves the current settings", async () => {
    const { result } = renderHook(() => useOptionsSettings());

    await waitFor(() => expect(result.current.loadState).toBe("ready"));
    expect(result.current.settings.themeMode).toBe("dark");

    act(() => result.current.updateSetting("language", "en-US"));
    expect(result.current.saveStatus).toBe("dirty");

    await act(() => result.current.save());

    expect(saveSettingsMock).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      language: "en-US",
      themeMode: "dark",
    });
    expect(result.current.saveStatus).toBe("saved");
  });

  it("keeps the dirty state when settings change during a save", async () => {
    let resolveSave!: () => void;
    saveSettingsMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSave = resolve;
      }),
    );
    const { result } = renderHook(() => useOptionsSettings());
    await waitFor(() => expect(result.current.loadState).toBe("ready"));

    act(() => result.current.updateSetting("modelName", "model-a"));
    let savePromise!: Promise<void>;
    act(() => {
      savePromise = result.current.save();
    });
    act(() => result.current.updateSetting("modelName", "model-b"));
    await act(async () => {
      resolveSave();
      await savePromise;
    });

    expect(result.current.saveStatus).toBe("dirty");
    expect(result.current.settings.modelName).toBe("model-b");
  });
});
