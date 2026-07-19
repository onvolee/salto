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
} from "../dictionary-client";
import { SourcesSection } from "./sources-section";

function createClients() {
  const dictionaryClient: OptionsDictionaryClient = {
    testConnection: vi.fn().mockResolvedValue(undefined),
  };
  const permissionClient: DictionaryPermissionClient = {
    request: vi.fn().mockResolvedValue(true),
  };
  return { dictionaryClient, permissionClient };
}

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
