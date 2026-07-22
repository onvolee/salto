// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SETTINGS,
  saveSettings,
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
            malformedTokens: [{ raw: "{{ }}", reason: "empty-variable" }],
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

vi.mock("salto-src/theme/theme-settings", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("salto-src/theme/theme-settings")
  >();
  return {
    ...actual,
    loadSettings: vi.fn().mockResolvedValue(actual.DEFAULT_SETTINGS),
    saveSettings: vi.fn().mockImplementation(async (settings) => settings),
  };
});

describe("OptionsApp", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.location.hash = "";
  });

  it("switches sections and protects the system template from field edits", async () => {
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
    expect(screen.getByRole("combobox", { name: "目标翻译语言" })).toBeInTheDocument();
    expect(screen.queryByText("匿名诊断")).not.toBeInTheDocument();

    const selectionMenu = screen.getByRole("button", { name: "划词翻译" });
    await user.click(selectionMenu);
    expect(selectionMenu).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "添加字段" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "复制" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "通用" }));
    await user.click(screen.getByRole("button", { name: "划词翻译" }));
    expect(screen.getByRole("button", { name: "添加字段" })).toBeDisabled();
  });

  it("separates reusable field definitions from template composition", async () => {
    render(<OptionsApp />);
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "通用" });
    await user.click(screen.getByRole("button", { name: "划词翻译" }));
    expect(screen.getByRole("tab", { name: "Templates" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Template fields" }));
    expect(window.location.hash).toBe("#/translate-template/fields");
    expect(await screen.findByRole("button", { name: "新建字段定义" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "新建字段定义" }));
    expect(screen.getByRole("dialog", { name: "新建字段定义" })).toBeInTheDocument();
    expect(screen.getByLabelText("字段名称")).toBeInTheDocument();
    expect(screen.getByLabelText("Instruction")).toBeInTheDocument();
  });

  it("adds the same library definition repeatedly and edits only snapshot appearance", async () => {
    render(<OptionsApp />);
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "通用" });
    await user.click(screen.getByRole("button", { name: "划词翻译" }));
    await user.click(screen.getByRole("button", { name: "新建模板" }));

    const add = await screen.findByRole("button", { name: "添加字段" });
    expect(add).toBeEnabled();
    await user.click(add);
    await user.click(add);

    expect(screen.getAllByText("Translation")).toHaveLength(2);
    expect(screen.queryByLabelText("Instruction")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "编辑Translation外观" })[0]);
    expect(screen.getByLabelText("Key CSS")).toBeInTheDocument();
    expect(screen.getByLabelText("当前模板预览")).toHaveTextContent("Translation");
  });

  it("previews and persists a changed theme", async () => {
    render(<OptionsApp />);
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "通用" });
    await user.click(screen.getByRole("button", { name: "深色" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("status")).toHaveTextContent("有未保存更改");

    await user.click(screen.getByRole("button", { name: "浅色" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    await user.click(screen.getByRole("button", { name: "跟随系统" }));
    expect(document.documentElement.dataset.theme).toBe("system");
    await user.click(screen.getByRole("button", { name: "深色" }));

    await user.click(screen.getByRole("button", { name: "保存设置" }));
    await waitFor(() => {
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("已保存");
      expect(status).toHaveClass("text-success");
    });

    expect(saveSettings).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      themeMode: "dark",
    });
  });

  it("keeps saved-vocabulary highlighting in the global settings draft", async () => {
    render(<OptionsApp />);
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "通用" });
    const highlight = screen.getByRole("switch", { name: "高亮已保存词汇" });
    expect(highlight).toBeChecked();

    await user.click(highlight);
    expect(highlight).not.toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("有未保存更改");

    await user.click(screen.getByRole("button", { name: "保存设置" }));
    await waitFor(() => expect(saveSettings).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      highlightEnabled: false,
    }));
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
    expect(screen.getByText(/上下文：.*\{\{pageText\}\}/)).toBeInTheDocument();
    expect(screen.getByText(/畸形变量 \{\{ \}\}/)).toBeInTheDocument();
  });

  it("shows only the fixed Youdao source without a provider selector", async () => {
    render(<OptionsApp />);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "通用" });

    await user.click(screen.getByRole("button", { name: "翻译源" }));

    expect(screen.getByText("有道词典")).toBeInTheDocument();
    expect(screen.getByText("当前词典")).toBeInTheDocument();
    expect(screen.queryByText("剑桥词典")).not.toBeInTheDocument();
    expect(screen.queryByText("AI 翻译")).not.toBeInTheDocument();
    expect(screen.queryByText("后续阶段")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "启用并测试" })).toBeInTheDocument();
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
    vi.mocked(browserOptionsLlmClient.saveConfig).mockResolvedValueOnce({
      config: {
        provider: "openai-compatible",
        baseUrl: "https://api.example.com/v1",
        model: "model-a",
        enableThinking: false,
      },
      hasApiKey: true,
    });
    vi.mocked(browserOptionsLlmClient.testConnection).mockResolvedValueOnce(
      undefined,
    );
    render(<OptionsApp />);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "通用" });

    await user.click(screen.getByRole("button", { name: "AI 服务" }));
    await user.click(screen.getByRole("button", { name: "保存并测试连接" }));

    await waitFor(() => {
      const statusElements = screen.getAllByText("连接成功");
      const pStatus = statusElements.find(el => el.closest("p"));
      expect(pStatus).toBeInTheDocument();
      expect(pStatus?.closest("p")).toHaveClass("text-success");
    });
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
    vi.mocked(browserOptionsLlmClient.saveConfig).mockResolvedValueOnce({
      config: {
        provider: "openai-compatible",
        baseUrl: "https://api.example.com/v1",
        model: "model-a",
        enableThinking: false,
      },
      hasApiKey: true,
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

  it("associates AI configuration errors with each invalid field", async () => {
    render(<OptionsApp />);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "通用" });

    await user.click(screen.getByRole("button", { name: "AI 服务" }));
    await user.click(screen.getByRole("button", { name: "保存并测试连接" }));

    const errorTitle = await screen.findByText("配置未保存");
    const alert = errorTitle.closest("[role='alert']");
    expect(alert).toHaveAttribute("id", "ai-provider-config-error");
    expect(screen.getByLabelText("模型名称")).toHaveAttribute(
      "aria-describedby",
      "ai-provider-config-error",
    );
    expect(screen.getByLabelText("API Key")).toHaveAttribute(
      "aria-describedby",
      "ai-provider-config-error",
    );
  });
});
