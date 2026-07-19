import { describe, expect, it, vi } from "vitest";

import type { ExtensionResponse } from "@salto/core";

import {
  createOptionsDictionaryClient,
  OptionsDictionaryError,
} from "./dictionary-client";

describe("options dictionary message client", () => {
  it("sends the fixed no-payload connection-test message", async () => {
    const send = vi.fn().mockResolvedValue({
      ok: true,
      type: "test-dictionary-connection",
      data: { connected: true, providerId: "youdao-web" },
    } satisfies ExtensionResponse);
    const client = createOptionsDictionaryClient(send);

    await expect(client.testConnection()).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: "test-dictionary-connection",
    });
  });

  it("rejects an unsafe or malformed background response", async () => {
    const send = vi.fn().mockResolvedValue({
      ok: true,
      type: "test-dictionary-connection",
      data: {
        connected: true,
        providerId: "youdao-web",
        html: "<main>provider-private-content</main>",
      },
    });
    const client = createOptionsDictionaryClient(send);

    await expect(client.testConnection()).rejects.toEqual(expect.objectContaining({
      code: "unexpected-response",
    } satisfies Partial<OptionsDictionaryError>));
  });
});
