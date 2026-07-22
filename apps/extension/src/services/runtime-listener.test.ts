import { describe, expect, it, vi } from "vitest";

import { createRuntimeMessageListener } from "./runtime-listener";

describe("runtime message listener", () => {
  it("keeps the response channel alive for async handlers", async () => {
    const handleMessage = vi.fn().mockResolvedValue({ ok: true, type: "list-highlight-terms", data: { enabled: true, terms: [] } });
    const sendResponse = vi.fn();
    const listener = createRuntimeMessageListener(
      { handleMessage },
      "chrome-extension://salto/",
    );

    expect(listener(
      { type: "list-highlight-terms" },
      { url: "https://example.com", tab: {} },
      sendResponse,
    )).toBe(true);
    expect(handleMessage).toHaveBeenCalledWith(
      { type: "list-highlight-terms" },
      { source: "content-script" },
    );
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      type: "list-highlight-terms",
      data: { enabled: true, terms: [] }
    }));
  });

  it("distinguishes the options page from other trusted extension pages", () => {
    const handleMessage = vi.fn().mockResolvedValue({
      ok: true,
      type: "test-llm-connection",
      data: { connected: true },
    });
    const listener = createRuntimeMessageListener(
      { handleMessage },
      "chrome-extension://salto/",
    );

    listener(
      { type: "test-llm-connection" },
      { url: "chrome-extension://salto/setting.html" },
      vi.fn(),
    );

    expect(handleMessage).toHaveBeenCalledWith(
      { type: "test-llm-connection" },
      { source: "options-page" },
    );

    listener(
      { type: "test-llm-connection" },
      { url: "chrome-extension://salto/popup.html" },
      vi.fn(),
    );
    expect(handleMessage).toHaveBeenLastCalledWith(
      { type: "test-llm-connection" },
      { source: "extension-page" },
    );
  });

  it("returns a stable failure response when an async handler rejects", async () => {
    const handleMessage = vi.fn().mockRejectedValue(new Error("database closed"));
    const sendResponse = vi.fn();
    const listener = createRuntimeMessageListener({ handleMessage });

    expect(listener({ type: "list-highlight-terms" }, {}, sendResponse)).toBe(true);

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: { code: "request-failed", message: "The extension request could not be completed" },
    }));
  });
});
