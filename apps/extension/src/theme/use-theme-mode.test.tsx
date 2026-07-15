// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, type SaltoSettings } from "./theme-settings";
import { useThemeMode } from "./use-theme-mode";

function ThemeProbe() {
  const themeMode = useThemeMode();
  return <span>{themeMode}</span>;
}

describe("useThemeMode", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads, subscribes to, and unsubscribes from theme settings", async () => {
    const darkSettings: SaltoSettings = { ...DEFAULT_SETTINGS, themeMode: "dark" };
    let storageListener: ((changes: Record<string, { newValue?: unknown }>) => void) | undefined;
    const removeListener = vi.fn();

    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({ [SETTINGS_STORAGE_KEY]: darkSettings }),
          set: vi.fn(),
        },
        onChanged: {
          addListener: vi.fn((listener: typeof storageListener) => {
            storageListener = listener;
          }),
          removeListener,
        },
      },
    });

    const view = render(<ThemeProbe />);

    expect(screen.getByText("system")).toBeInTheDocument();
    expect(await screen.findByText("dark")).toBeInTheDocument();

    act(() => {
      storageListener?.({
        [SETTINGS_STORAGE_KEY]: {
          newValue: { ...darkSettings, themeMode: "light" },
        },
      });
    });

    expect(screen.getByText("light")).toBeInTheDocument();

    view.unmount();
    await waitFor(() => expect(removeListener).toHaveBeenCalledOnce());
  });
});
