// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
} from "salto-src/theme/theme-settings";

import { OptionsApp } from "./OptionsApp";
import { browserOptionsLlmClient, OptionsLlmError } from "./llm-client";

vi.mock("./llm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./llm-client")>();
  return {
    ...actual,
    browserOptionsLlmClient: {
      getConfig: vi.fn().mockResolvedValue({
        hasApiKey: false,
        promptAnalysis: {
          referencedVariables: ["selection", "targetLanguage"],
          warnings: [{
            fieldId: "field-warning",
            fieldLabel: "上下文",
            unknownVariables: ["pageText"],
          }],
        },
      }),
      saveConfig: vi.fn(),
      testConnection: vi.fn(),
    },
    browserLlmPermissionClient: {
      request: vi.fn().mockResolvedValue(true),
      remove: vi.fn().mockResolvedValue(true),
    },
  };
});

describe("OptionsApp", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("switches sections and protects the system template from field edits", async () => {
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
    expect(screen.getByRole("button", { name: "添加字段" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "复制" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "通用" }));
    await user.click(screen.getByRole("button", { name: "划词翻译" }));
    expect(screen.getByRole("button", { name: "添加字段" })).toBeDisabled();
  });

  it("previews and persists a changed theme", async () => {
    render(<OptionsApp />);
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "通用" });
    await user.click(screen.getByRole("button", { name: "深色" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("status")).toHaveTextContent("有未保存更改");

    await user.click(screen.getByRole("button", { name: "保存设置" }));
    await waitFor(() => {
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("已保存");
      expect(status).toHaveClass("text-success");
    });

    const savedSettings = JSON.parse(
      localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "null",
    ) as typeof DEFAULT_SETTINGS;
    expect(savedSettings.themeMode).toBe("dark");
  });

  it("renders write-only AI configuration and privacy disclosure", async () => {
    render(<OptionsApp />);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "通用" });

    await user.click(screen.getByRole("button", { name: "AI 服务" }));

    expect(screen.getByText("OpenAI-compatible")).toBeInTheDocument();
    expect(screen.getByLabelText("API Key")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "保存并测试连接" })).toBeInTheDocument();
    expect(screen.getByText("页面上下文传输")).toBeInTheDocument();
    expect(screen.getByText(/当前活动模板会发送：所选文本、目标语言/)).toBeInTheDocument();
    expect(screen.getByText("模板变量警告")).toBeInTheDocument();
    expect(screen.getByText(/上下文：\{\{pageText\}\}/)).toBeInTheDocument();
  });

  it("shows provider availability without prototype-only controls", async () => {
    render(<OptionsApp />);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "通用" });

    await user.click(screen.getByRole("button", { name: "翻译源" }));

    expect(screen.getByText("未配置")).toBeInTheDocument();
    expect(screen.getAllByText("后续阶段")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /测试/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("renders connection success with the success theme color", async () => {
    vi.mocked(browserOptionsLlmClient.getConfig).mockResolvedValueOnce({
      config: {
        provider: "openai-compatible",
        baseUrl: "https://api.example.com/v1",
        model: "model-a",
      },
      hasApiKey: true,
      promptAnalysis: { referencedVariables: [], warnings: [] },
    });
    vi.mocked(browserOptionsLlmClient.testConnection).mockResolvedValueOnce(
      undefined,
    );
    render(<OptionsApp />);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "通用" });

    await user.click(screen.getByRole("button", { name: "AI 服务" }));
    await user.click(screen.getByRole("button", { name: "保存并测试连接" }));

    const status = await screen.findByText("连接成功");
    expect(status.closest("p")).toHaveClass("text-success");
  });

  it("renders connection failures as destructive alerts", async () => {
    vi.mocked(browserOptionsLlmClient.getConfig).mockResolvedValueOnce({
      config: {
        provider: "openai-compatible",
        baseUrl: "https://api.example.com/v1",
        model: "model-a",
      },
      hasApiKey: true,
      promptAnalysis: { referencedVariables: [], warnings: [] },
    });
    vi.mocked(browserOptionsLlmClient.testConnection).mockRejectedValueOnce(
      new OptionsLlmError("authentication", "Authentication failed"),
    );
    render(<OptionsApp />);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "通用" });

    await user.click(screen.getByRole("button", { name: "AI 服务" }));
    await user.click(screen.getByRole("button", { name: "保存并测试连接" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("认证失败，请检查 API Key");
    expect(alert).toHaveClass("text-destructive");
  });
});
