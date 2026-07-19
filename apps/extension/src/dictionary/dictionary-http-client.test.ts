import { describe, expect, it, vi } from "vitest";

import { createDictionaryHttpClient } from "./dictionary-http-client";

describe("dictionary HTTP boundary", () => {
  it("returns a decoded HTML response through the guarded boundary", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(
      "<main>bank</main>",
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    ));
    const client = createDictionaryHttpClient({ fetch });

    await expect(client.getText({
      url: "https://dictionary.example/bank",
      signal: new AbortController().signal
    })).resolves.toBe("<main>bank</main>");
    expect(fetch.mock.calls[0]?.[1]?.credentials).toBe("omit");
  });

  it("aborts a slow request and returns a stable timeout error", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation((_request, init) => (
      new Promise((_resolve, reject) => {
        const rejectAbort = () => reject(init?.signal?.reason ?? new DOMException(
          "Timed out with provider secret",
          "AbortError"
        ));
        if (init?.signal?.aborted) {
          rejectAbort();
        } else {
          init?.signal?.addEventListener("abort", rejectAbort, { once: true });
        }
      })
    ));
    const client = createDictionaryHttpClient({ fetch, timeoutMs: 5 });

    await expect(client.getText({
      url: "https://dictionary.example/slow",
      signal: new AbortController().signal
    })).rejects.toEqual(expect.objectContaining({
      code: "timeout",
      message: "The dictionary lookup timed out"
    }));
  });

  it("honors caller cancellation while a request is running", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation((_request, init) => (
      new Promise((_resolve, reject) => {
        const rejectAbort = () => reject(new DOMException("provider detail", "AbortError"));
        if (init?.signal?.aborted) {
          rejectAbort();
        } else {
          init?.signal?.addEventListener("abort", rejectAbort, { once: true });
        }
      })
    ));
    const controller = new AbortController();
    const client = createDictionaryHttpClient({ fetch, timeoutMs: 30_000 });
    const lookup = client.getText({
      url: "https://dictionary.example/slow",
      signal: controller.signal
    });

    controller.abort();

    await expect(lookup).rejects.toEqual(expect.objectContaining({
      code: "cancelled",
      message: "The dictionary lookup was cancelled"
    }));
  });

  it("rejects an unexpected content type without returning the body", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(
      JSON.stringify({ secret: "provider-secret" }),
      { headers: { "Content-Type": "application/json" } }
    ));
    const client = createDictionaryHttpClient({ fetch });

    await expect(client.getText({
      url: "https://dictionary.example/bank",
      signal: new AbortController().signal
    })).rejects.toEqual(expect.objectContaining({
      code: "invalid-content-type",
      message: "The dictionary provider returned an unsupported content type"
    }));
  });

  it("stops reading a response that exceeds the byte limit", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(
      "12345",
      { headers: { "Content-Type": "text/html" } }
    ));
    const client = createDictionaryHttpClient({ fetch, maxResponseBytes: 4 });

    await expect(client.getText({
      url: "https://dictionary.example/bank",
      signal: new AbortController().signal
    })).rejects.toEqual(expect.objectContaining({
      code: "response-too-large",
      message: "The dictionary response exceeded the size limit"
    }));
  });

  it("maps an HTTP failure without exposing its response body", async () => {
    const cancel = vi.fn();
    const responseBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("provider-secret-response"));
      },
      cancel
    });
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(
      responseBody,
      {
        status: 503,
        headers: { "Content-Type": "text/html" }
      }
    ));
    const client = createDictionaryHttpClient({ fetch });

    await expect(client.getText({
      url: "https://dictionary.example/private-path",
      signal: new AbortController().signal
    })).rejects.toEqual(expect.objectContaining({
      code: "provider-error",
      message: "The dictionary provider request failed"
    }));
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("maps a transport failure without exposing its cause", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(
      new Error("network failed near provider-secret-host")
    );
    const client = createDictionaryHttpClient({ fetch });

    await expect(client.getText({
      url: "https://dictionary.example/private-path",
      signal: new AbortController().signal
    })).rejects.toEqual(expect.objectContaining({
      code: "network",
      message: "The dictionary provider could not be reached"
    }));
  });

  it("retries a transient provider response only when configured", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response("temporary", {
        status: 503,
        headers: { "Content-Type": "text/html" }
      }))
      .mockResolvedValueOnce(new Response("<main>bank</main>", {
        headers: { "Content-Type": "text/html" }
      }));
    const client = createDictionaryHttpClient({ fetch, retry: 1 });

    await expect(client.getText({
      url: "https://dictionary.example/bank",
      signal: new AbortController().signal
    })).resolves.toBe("<main>bank</main>");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
