import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { createDictionaryClient } from "@salto/core";
import { dictionaryAdapterContract } from "@salto/core/testing";

import { createDictionaryHttpClient } from "./dictionary-http-client";
import { createYoudaoWebAdapter, YOUDAO_PERMISSION_ORIGIN } from "./youdao-web-adapter";

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/youdao-web/${name}.html`, import.meta.url), "utf8");
}

dictionaryAdapterContract("youdao-web", {
  providerId: "youdao-web",
  createAdapter(scenario) {
    const html = scenario === "complete"
      ? fixture("common-word")
      : scenario === "missing-fields"
        ? fixture("missing-fields")
        : fixture("markup-changed");
    return createYoudaoWebAdapter({
      httpClient: { async getText() { return html; } },
      hasOriginPermission: async () => true
    });
  }
});

describe("youdao-web adapter", () => {
  it("builds requests only from the fixed origin and encoded lookup term", async () => {
    const getText = vi.fn().mockResolvedValue(fixture("common-word"));
    const hasOriginPermission = vi.fn().mockResolvedValue(true);
    const signal = new AbortController().signal;
    const adapter = createYoudaoWebAdapter({
      httpClient: { getText },
      hasOriginPermission
    });

    await adapter.lookup({ term: "bank account", language: "en" }, signal);

    expect(hasOriginPermission).toHaveBeenCalledWith(YOUDAO_PERMISSION_ORIGIN);
    expect(getText).toHaveBeenCalledWith({
      url: "https://dict.youdao.com/w/eng/bank%20account/",
      signal
    });
  });

  it("rejects missing origin permission before starting HTTP", async () => {
    const getText = vi.fn();
    const adapter = createYoudaoWebAdapter({
      httpClient: { getText },
      hasOriginPermission: async () => false
    });

    await expect(adapter.lookup(
      { term: "bank", language: "en" },
      new AbortController().signal
    )).rejects.toEqual(expect.objectContaining({ code: "permission-denied" }));
    expect(getText).not.toHaveBeenCalled();
  });

  it("maps an explicit not-found page separately from missing optional fields", async () => {
    const adapter = createYoudaoWebAdapter({
      httpClient: { async getText() { return fixture("not-found"); } },
      hasOriginPermission: async () => true
    });
    const result = await createDictionaryClient(adapter).lookup(
      { term: "unknown", language: "en" },
      new AbortController().signal
    );

    expect(Object.values(result.fields)).toEqual([
      { status: "unavailable", type: "text", reason: "not-found" },
      { status: "unavailable", type: "text", reason: "not-found" },
      { status: "unavailable", type: "text", reason: "not-found" },
      { status: "unavailable", type: "list", reason: "not-found" },
      { status: "unavailable", type: "list", reason: "not-found" }
    ]);
  });

  it.each([
    ["invalid-content-type", new Response("{}", { headers: { "Content-Type": "application/json" } }), {}],
    ["response-too-large", new Response("12345", { headers: { "Content-Type": "text/html" } }), { maxResponseBytes: 4 }]
  ] as const)("preserves the %s HTTP boundary failure", async (code, response, options) => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response);
    const adapter = createYoudaoWebAdapter({
      httpClient: createDictionaryHttpClient({ fetch, ...options }),
      hasOriginPermission: async () => true
    });

    await expect(adapter.lookup(
      { term: "bank", language: "en" },
      new AbortController().signal
    )).rejects.toEqual(expect.objectContaining({ code }));
  });

  it("preserves timeout and caller cancellation from the HTTP boundary", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation((_request, init) => (
      new Promise((_resolve, reject) => {
        const rejectAbort = () => reject(new DOMException("aborted", "AbortError"));
        init?.signal?.addEventListener("abort", rejectAbort, { once: true });
      })
    ));
    const timedAdapter = createYoudaoWebAdapter({
      httpClient: createDictionaryHttpClient({ fetch, timeoutMs: 5 }),
      hasOriginPermission: async () => true
    });
    await expect(timedAdapter.lookup(
      { term: "bank", language: "en" },
      new AbortController().signal
    )).rejects.toEqual(expect.objectContaining({ code: "timeout" }));

    const controller = new AbortController();
    const cancelledAdapter = createYoudaoWebAdapter({
      httpClient: createDictionaryHttpClient({ fetch, timeoutMs: 30_000 }),
      hasOriginPermission: async () => true
    });
    const lookup = cancelledAdapter.lookup({ term: "bank", language: "en" }, controller.signal);
    controller.abort();
    await expect(lookup).rejects.toEqual(expect.objectContaining({ code: "cancelled" }));
  });
});
