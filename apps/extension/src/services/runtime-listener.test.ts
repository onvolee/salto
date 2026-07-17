import { describe, expect, it, vi } from "vitest";

import { createRuntimeMessageListener } from "./runtime-listener";

describe("runtime message listener", () => {
  it("keeps the response channel alive for async handlers", async () => {
    const handleMessage = vi.fn().mockResolvedValue({ ok: true, type: "list-highlight-terms", data: { terms: [] } });
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
      data: { terms: [] }
    }));
  });

  it("marks extension pages as trusted settings senders", () => {
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
      { source: "extension-page" },
    );
  });
});
