import { describe, expect, it, vi } from "vitest";

import { createRuntimeMessageListener } from "./runtime-listener";

describe("runtime message listener", () => {
  it("keeps the response channel alive for async handlers", async () => {
    const handleMessage = vi.fn().mockResolvedValue({ ok: true, type: "list-highlight-terms", data: { terms: [] } });
    const sendResponse = vi.fn();
    const listener = createRuntimeMessageListener({ handleMessage });

    expect(listener({ type: "list-highlight-terms" }, {}, sendResponse)).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      type: "list-highlight-terms",
      data: { terms: [] }
    }));
  });
});
