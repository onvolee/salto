import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "./theme-settings";

describe("theme settings", () => {
  it("follows the system theme when no preference has been saved", () => {
    expect(DEFAULT_SETTINGS.themeMode).toBe("system");
  });
});
