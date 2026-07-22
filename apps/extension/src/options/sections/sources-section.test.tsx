// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  OptionsDictionaryError,
  YOUDAO_PERMISSION_ORIGIN,
  type DictionaryPermissionClient,
  type OptionsDictionaryClient,
  type YoudaoTestPreview,
} from "../dictionary-client";
import { SourcesSection } from "./sources-section";

function createClients() {
  const dictionaryClient: OptionsDictionaryClient = {
    testConnection: vi.fn().mockResolvedValue({
      term: "example",
      sections: [{ kind: "basic", entries: ["n. 示例"] }],
    }),
  };
  const permissionClient: DictionaryPermissionClient = {
    request: vi.fn().mockResolvedValue(true),
  };
  return { dictionaryClient, permissionClient };
}

const preview: YoudaoTestPreview = {
  term: "example",
  sections: [
    { kind: "basic", entries: ["n. 示例"] },
    { kind: "word-forms", entries: [{ label: "复数", value: "examples" }] },
    { kind: "phrases", entries: [{ phrase: "for example", meaning: "例如" }] },
    { kind: "examples", entries: [{ english: "This is an example.", chinese: "这是一个例子。", source: "Source A" }] },
  ],
};

describe("SourcesSection", () => {
  afterEach(cleanup);

  it("shows only the fixed Youdao provider and does nothing before the user gesture", () => {
    const clients = createClients();

    render(<SourcesSection {...clients} />);

    expect(screen.getByText("有道词典")).toBeInTheDocument();
    expect(screen.getByText("当前词典")).toBeInTheDocument();
    expect(screen.queryByText("剑桥词典")).not.toBeInTheDocument();
    expect(screen.queryByText("AI 翻译")).not.toBeInTheDocument();
    expect(screen.queryByText("后续阶段")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "启用并测试" })).toBeEnabled();
    expect(clients.permissionClient.request).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "测试词" })).toHaveValue("example");
    expect(clients.dictionaryClient.testConnection).not.toHaveBeenCalled();
  });

  it("requests only the exact Youdao host and remains retryable after denial", async () => {
    const clients = createClients();
    vi.mocked(clients.permissionClient.request)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const user = userEvent.setup();
    render(<SourcesSection {...clients} />);

    await user.click(screen.getByRole("button", { name: "启用并测试" }));

    expect(clients.permissionClient.request).toHaveBeenNthCalledWith(
      1,
      YOUDAO_PERMISSION_ORIGIN,
    );
    expect(clients.dictionaryClient.testConnection).not.toHaveBeenCalled();
    expect(screen.getByText("未授予有道词典访问权限，可重新测试。"))
      .toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重新测试" }));

    expect(clients.permissionClient.request).toHaveBeenNthCalledWith(
      2,
      YOUDAO_PERMISSION_ORIGIN,
    );
    await waitFor(() => {
      expect(clients.dictionaryClient.testConnection).toHaveBeenCalledOnce();
      expect(screen.getByText("有道词典连接成功。")).toBeInTheDocument();
    });
  });

  it("submits the editable test word and lets the user inspect the current-session preview", async () => {
    const clients = createClients();
    vi.mocked(clients.dictionaryClient.testConnection).mockResolvedValue(preview);
    const user = userEvent.setup();
    render(<SourcesSection {...clients} />);

    await user.clear(screen.getByRole("textbox", { name: "测试词" }));
    await user.type(screen.getByRole("textbox", { name: "测试词" }), "sample");
    await user.click(screen.getByRole("button", { name: "启用并测试" }));

    await waitFor(() => {
      expect(clients.dictionaryClient.testConnection).toHaveBeenCalledWith("sample");
    });
    expect(screen.getByRole("button", { name: "查看结果" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "查看结果" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "example" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "基础释义" })).toBeInTheDocument();
    expect(screen.getByText("复数")).toBeInTheDocument();
    expect(screen.getByText("examples")).toBeInTheDocument();
    expect(screen.getByText("for example")).toBeInTheDocument();
    expect(screen.getByText("This is an example.")).toBeInTheDocument();
    expect(screen.getByText("这是一个例子。")).toBeInTheDocument();
    expect(screen.getByText("Source A")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "近义词辨析" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "关闭" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows clear no-result and parser-failure states without opening a preview", async () => {
    const clients = createClients();
    vi.mocked(clients.dictionaryClient.testConnection)
      .mockRejectedValueOnce(new OptionsDictionaryError("not-found", "private provider detail"))
      .mockRejectedValueOnce(new OptionsDictionaryError("parser-failure", "private provider detail"));
    const user = userEvent.setup();
    render(<SourcesSection {...clients} />);

    await user.click(screen.getByRole("button", { name: "启用并测试" }));
    expect(await screen.findByText("未找到该测试词的有道结果，请修改后重新测试。"))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看结果" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重新测试" }));
    expect(await screen.findByText("有道词典结果无法解析，请稍后重新测试。"))
      .toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps long preview content in the dialog scroll area", async () => {
    const clients = createClients();
    vi.mocked(clients.dictionaryClient.testConnection).mockResolvedValue({
      term: "example",
      sections: [{
        kind: "examples",
        entries: Array.from({ length: 80 }, (_, index) => ({ english: `Example sentence ${index + 1}` })),
      }],
    });
    const user = userEvent.setup();
    render(<SourcesSection {...clients} />);

    await user.click(screen.getByRole("button", { name: "启用并测试" }));
    await user.click(await screen.findByRole("button", { name: "查看结果" }));

    expect(screen.getByTestId("youdao-preview-scroll")).toHaveClass("overflow-y-auto");
    expect(screen.getByText("Example sentence 80")).toBeInTheDocument();
  });

  it("renders duplicate provider examples as separate list items", async () => {
    const clients = createClients();
    vi.mocked(clients.dictionaryClient.testConnection).mockResolvedValue({
      term: "example",
      sections: [{
        kind: "examples",
        entries: [
          { english: "Repeated provider example." },
          { english: "Repeated provider example." },
        ],
      }],
    });
    const user = userEvent.setup();
    render(<SourcesSection {...clients} />);

    await user.click(screen.getByRole("button", { name: "启用并测试" }));
    await user.click(await screen.findByRole("button", { name: "查看结果" }));

    expect(screen.getAllByText("Repeated provider example.")).toHaveLength(2);
  });

  it("shows a stable retryable failure without provider response content", async () => {
    const clients = createClients();
    vi.mocked(clients.dictionaryClient.testConnection).mockRejectedValue(
      new OptionsDictionaryError(
        "provider",
        "<main>provider-private-content</main>",
      ),
    );
    const user = userEvent.setup();
    render(<SourcesSection {...clients} />);

    await user.click(screen.getByRole("button", { name: "启用并测试" }));

    expect(await screen.findByText("有道词典暂时不可用，请重新测试。"))
      .toBeInTheDocument();
    expect(screen.queryByText(/provider-private-content/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新测试" })).toBeEnabled();
  });
});
