// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS, type SaltoSettings } from "./theme-settings";
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
    let runtimeListener: ((message: unknown) => void) | undefined;
    const removeListener = vi.fn();

    vi.stubGlobal("browser", {
      runtime: {
        sendMessage: vi.fn().mockResolvedValue({
          ok: true,
          type: "get-extension-settings",
          data: darkSettings,
        }),
        onMessage: {
          addListener: vi.fn((listener: typeof runtimeListener) => {
            runtimeListener = listener;
          }),
          removeListener,
        },
      },
    });

    const view = render(<ThemeProbe />);

    expect(screen.getByText("system")).toBeInTheDocument();
    expect(await screen.findByText("dark")).toBeInTheDocument();

    act(() => {
      runtimeListener?.({
        type: "extension-settings-changed",
        payload: { ...darkSettings, themeMode: "light" },
      });
    });

    expect(screen.getByText("light")).toBeInTheDocument();

    view.unmount();
    await waitFor(() => expect(removeListener).toHaveBeenCalledOnce());
  });
});
