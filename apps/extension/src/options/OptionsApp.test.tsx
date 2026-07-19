// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("edits template fields in a dialog instead of inline in the list", async () => {
    render(<OptionsApp />);
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "通用" });
    await user.click(screen.getByRole("button", { name: "划词翻译" }));
    await user.click(screen.getByRole("button", { name: "新建模板" }));

    expect(screen.queryByLabelText("Label")).not.toBeInTheDocument();
    expect(screen.getByText("翻译")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "编辑翻译" }));
    expect(screen.getByRole("dialog", { name: "编辑字段" })).toBeInTheDocument();

    const labelInput = screen.getByLabelText("Label");
    await user.clear(labelInput);
    await user.click(screen.getByRole("button", { name: "应用" }));

    expect(screen.getByRole("dialog", { name: "编辑字段" })).toBeInTheDocument();
    expect(labelInput).toHaveFocus();
    expect(screen.getByText("字段名称不能为空")).toBeInTheDocument();

    await user.type(labelInput, "摘要");
    await user.click(screen.getByRole("button", { name: "取消" }));

    expect(screen.queryByRole("dialog", { name: "编辑字段" })).not.toBeInTheDocument();
    expect(screen.getByText("翻译")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "编辑翻译" }));
    await user.clear(screen.getByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "摘要");
    await user.click(screen.getByRole("button", { name: "应用" }));

    expect(screen.queryByRole("dialog", { name: "编辑字段" })).not.toBeInTheDocument();
    expect(screen.getByText("摘要")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "添加字段" }));
    await user.click(screen.getByRole("button", { name: "编辑新字段" }));
    await user.clear(screen.getByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "上下文");
    await user.type(screen.getByLabelText("Instruction"), "Summarize the context.");
    await user.click(screen.getByRole("button", { name: "应用" }));

    expect(screen.getByText("上下文")).toBeInTheDocument();
  });

  it("inserts every prompt variable at the textarea selection without a provider request", async () => {
    render(<OptionsApp />);
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "通用" });
    await user.click(screen.getByRole("button", { name: "划词翻译" }));
    await user.click(screen.getByRole("button", { name: "新建模板" }));
    await user.click(screen.getByRole("button", { name: "编辑翻译" }));

    const instruction = screen.getByLabelText("Instruction") as HTMLTextAreaElement;
    const variableSelect = screen.getByLabelText("插入变量");
    const variables = [
      "selection",
      "sentence",
      "paragraphs",
      "targetLanguage",
      "webTitle",
      "webUrl",
      "webContent",
    ] as const;

    expect(screen.getAllByRole("option").map((option) => option.getAttribute("value")))
      .toEqual(["", ...variables]);

    for (const variable of variables) {
      instruction.focus();
      instruction.setSelectionRange(0, instruction.value.length);
      await user.selectOptions(variableSelect, variable);
      const expected = `{{${variable}}}`;
      expect(instruction).toHaveValue(expected);
      expect(instruction).toHaveFocus();
      expect(instruction.selectionStart).toBe(expected.length);
      expect(instruction.selectionEnd).toBe(expected.length);
    }

    expect(browserOptionsLlmClient.testConnection).not.toHaveBeenCalled();
  });

  it("links distinct prompt warnings to the instruction and keeps them non-blocking", async () => {
    render(<OptionsApp />);
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "通用" });
    await user.click(screen.getByRole("button", { name: "划词翻译" }));
    await user.click(screen.getByRole("button", { name: "新建模板" }));
    await user.click(screen.getByRole("button", { name: "编辑翻译" }));

    const instruction = screen.getByLabelText("Instruction");
    fireEvent.change(instruction, { target: { value: "Use {{pageText}} and {{ }}." } });

    expect(screen.getByText("变量警告（仍可保存）")).toBeInTheDocument();
    expect(screen.getByText("未知变量：{{pageText}}")).toBeInTheDocument();
    expect(screen.getByText("畸形变量：{{ }}（变量名为空）")).toBeInTheDocument();
    expect(instruction.getAttribute("aria-describedby")).toContain("instruction-warning");

    await user.click(screen.getByRole("button", { name: "应用" }));
    expect(screen.queryByRole("dialog", { name: "编辑字段" })).not.toBeInTheDocument();
    expect(screen.getByText("2 个变量警告（仍可保存）")).toBeInTheDocument();
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
