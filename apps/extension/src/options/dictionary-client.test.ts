import { describe, expect, it, vi } from "vitest";

import type { ExtensionResponse } from "@salto/core";

import {
  createOptionsDictionaryClient,
  OptionsDictionaryError,
} from "./dictionary-client";

describe("options dictionary message client", () => {
  it("sends only the editable test word and unwraps the structured preview", async () => {
    const send = vi.fn().mockResolvedValue({
      ok: true,
      type: "test-dictionary-connection",
      data: {
        providerId: "youdao-web",
        preview: {
          term: "example",
          sections: [
            { kind: "basic", entries: ["n. 示例"] },
            { kind: "word-forms", entries: [{ label: "复数", value: "examples" }] },
            { kind: "phrases", entries: [{ phrase: "for example", meaning: "例如" }] },
            { kind: "examples", entries: [{ english: "An example.", chinese: "一个例子。", source: "Source" }] },
          ],
        },
      },
    } satisfies ExtensionResponse);
    const client = createOptionsDictionaryClient(send);

    await expect(client.testConnection("example")).resolves.toEqual({
      term: "example",
      sections: [
        { kind: "basic", entries: ["n. 示例"] },
        { kind: "word-forms", entries: [{ label: "复数", value: "examples" }] },
        { kind: "phrases", entries: [{ phrase: "for example", meaning: "例如" }] },
        { kind: "examples", entries: [{ english: "An example.", chinese: "一个例子。", source: "Source" }] },
      ],
    });

    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: "test-dictionary-connection",
      payload: { term: "example" },
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

    await expect(client.testConnection("example")).rejects.toEqual(expect.objectContaining({
      code: "unexpected-response",
    } satisfies Partial<OptionsDictionaryError>));
  });

  it("rejects a flattened structured section", async () => {
    const send = vi.fn().mockResolvedValue({
      ok: true,
      type: "test-dictionary-connection",
      data: {
        providerId: "youdao-web",
        preview: {
          term: "example",
          sections: [{ kind: "word-forms", entries: ["复数 examples"] }],
        },
      },
    });

    await expect(createOptionsDictionaryClient(send).testConnection("example"))
      .rejects.toEqual(expect.objectContaining({ code: "unexpected-response" }));
  });
});
