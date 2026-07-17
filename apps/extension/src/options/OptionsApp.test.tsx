// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
} from "salto-src/theme/theme-settings";

import { OptionsApp } from "./OptionsApp";

describe("OptionsApp", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("switches sections and keeps locally edited translation fields", async () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(DEFAULT_SETTINGS),
    );
    render(<OptionsApp />);
    const user = userEvent.setup();

    expect(
      await screen.findByRole("heading", { name: "通用" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "通用" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("button", { name: "切换设置菜单" }),
    ).toBeInTheDocument();

    const selectionMenu = screen.getByRole("button", { name: "划词翻译" });
    await user.click(selectionMenu);
    expect(selectionMenu).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("button", { name: "添加字段" }));
    expect(screen.getByText("新字段")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "通用" }));
    await user.click(screen.getByRole("button", { name: "划词翻译" }));
    expect(screen.getByText("新字段")).toBeInTheDocument();
  });

  it("previews and persists a changed theme", async () => {
    render(<OptionsApp />);
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "通用" });
    await user.click(screen.getByRole("button", { name: "深色" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("status")).toHaveTextContent("有未保存更改");

    await user.click(screen.getByRole("button", { name: "保存设置" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("已保存"),
    );

    const savedSettings = JSON.parse(
      localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "null",
    ) as typeof DEFAULT_SETTINGS;
    expect(savedSettings.themeMode).toBe("dark");
  });
});
