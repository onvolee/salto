// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useSettingsRouter } from "./use-settings-router";

describe("useSettingsRouter", () => {
  afterEach(() => { window.location.hash = ""; });

  it("restores template fields from the hash and follows history changes", () => {
    window.location.hash = "#/translate-template/fields";
    const { result } = renderHook(() => useSettingsRouter());

    expect(result.current.activeSection).toBe("selection");
    expect(result.current.selectionView).toBe("fields");

    act(() => {
      window.location.hash = "#/translate-template";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current.selectionView).toBe("templates");

    act(() => result.current.navigateToSelectionView("fields"));
    expect(window.location.hash).toBe("#/translate-template/fields");
  });
});
