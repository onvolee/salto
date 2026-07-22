import { DictionaryLookupError } from "@salto/core";
import { createFetch, FetchError } from "ofetch";

export interface DictionaryHttpRequest {
  readonly url: string;
  readonly signal: AbortSignal;
}

export interface DictionaryHttpClient {
  getText(request: DictionaryHttpRequest): Promise<string>;
}

export interface DictionaryHttpClientOptions {
  readonly fetch?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
  readonly acceptedContentTypes?: readonly string[];
  readonly retry?: number;
  readonly retryDelayMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1_000_000;
const DEFAULT_ACCEPTED_CONTENT_TYPES = ["text/html", "application/xhtml+xml"] as const;

function responseContentType(response: Response): string {
  return response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

async function cancelStream(stream: ReadableStream<Uint8Array> | undefined): Promise<void> {
  try {
    await stream?.cancel();
  } catch {
    // Response cleanup must not replace the stable request outcome.
  }
}

async function readTextStream(
  stream: ReadableStream<Uint8Array> | undefined,
  maxResponseBytes: number
): Promise<string> {
  if (!stream) {
    return "";
  }
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      return text + decoder.decode();
    }
    receivedBytes += value.byteLength;
    if (receivedBytes > maxResponseBytes) {
      await reader.cancel();
      throw new DictionaryLookupError("response-too-large");
    }
    text += decoder.decode(value, { stream: true });
  }
}

export function createDictionaryHttpClient(
  options: DictionaryHttpClientOptions = {}
): DictionaryHttpClient {
  const request = createFetch(options.fetch ? { fetch: options.fetch } : undefined);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const retry = options.retry ?? 0;
  const retryDelay = options.retryDelayMs ?? 0;
  const acceptedContentTypes = new Set(
    (options.acceptedContentTypes ?? DEFAULT_ACCEPTED_CONTENT_TYPES)
      .map((contentType) => contentType.toLowerCase())
  );

  return {
    async getText({ url, signal }) {
      if (signal.aborted) {
        throw new DictionaryLookupError("cancelled");
      }

      const controller = new AbortController();
      let timedOut = false;
      const cancel = () => controller.abort(signal.reason);
      signal.addEventListener("abort", cancel, { once: true });
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      try {
        const response = await request.raw(url, {
          credentials: "omit",
          responseType: "stream",
          retry,
          retryDelay,
          signal: controller.signal,
          async onResponseError({ response }) {
            await cancelStream(response._data);
          }
        });
        if (!acceptedContentTypes.has(responseContentType(response))) {
          await cancelStream(response._data);
          throw new DictionaryLookupError("invalid-content-type");
        }
        const declaredLength = Number(response.headers.get("content-length"));
        if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
          await cancelStream(response._data);
          throw new DictionaryLookupError("response-too-large");
        }
        return await readTextStream(response._data, maxResponseBytes);
      } catch (error) {
        if (error instanceof DictionaryLookupError) {
          throw error;
        }
        if (signal.aborted) {
          throw new DictionaryLookupError("cancelled");
        }
        if (timedOut) {
          throw new DictionaryLookupError("timeout");
        }
        if (error instanceof FetchError && error.response) {
          await cancelStream(error.response._data);
          throw new DictionaryLookupError("provider-error");
        }
        throw new DictionaryLookupError("network");
      } finally {
        clearTimeout(timeout);
        signal.removeEventListener("abort", cancel);
      }
    }
  };
}
