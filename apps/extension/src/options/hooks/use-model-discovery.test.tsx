// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useModelDiscovery } from "./use-model-discovery";

describe("useModelDiscovery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports the number of models returned by a compatible endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: [{ id: "gpt-4.1" }, { id: "o4-mini" }, {}],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() =>
      useModelDiscovery("https://example.test/v1/", "secret"),
    );

    await act(() => result.current.fetchModels());

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/v1/models",
      expect.objectContaining({
        headers: { Authorization: "Bearer secret" },
      }),
    );
    expect(result.current.message).toBe("已获取 2 个模型");
    expect(result.current.isLoading).toBe(false);
  });
});
