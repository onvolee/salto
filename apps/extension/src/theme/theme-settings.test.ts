// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SETTINGS,
  loadSettings,
  SETTINGS_STORAGE_KEY,
} from "./theme-settings";

describe("theme settings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("follows the system theme when no preference has been saved", () => {
    expect(DEFAULT_SETTINGS.themeMode).toBe("system");
  });

  it("scrubs legacy API credentials from UI preference storage", async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            [SETTINGS_STORAGE_KEY]: {
              ...DEFAULT_SETTINGS,
              apiBaseUrl: "https://legacy.example/v1",
              apiKey: "legacy-secret",
              modelName: "legacy-model",
              provider: "openai-compatible",
            },
          }),
          set,
        },
      },
    });

    const settings = await loadSettings();

    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(JSON.stringify(settings)).not.toContain("legacy-secret");
    expect(set).toHaveBeenCalledWith({ [SETTINGS_STORAGE_KEY]: DEFAULT_SETTINGS });
  });
});
