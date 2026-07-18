import { describe, expect, it, vi } from "vitest";

import { DEFAULT_EXTENSION_SETTINGS } from "@salto/core";

import { createSettingsNotificationPublisher } from "./settings-notifications";

describe("settings notification publisher", () => {
  it("broadcasts one typed public notification to extension pages and every connected tab", async () => {
    const sendRuntime = vi.fn().mockRejectedValue(new Error("No extension page"));
    const sendTab = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Tab navigated"));
    const publish = createSettingsNotificationPublisher({
      queryTabs: vi.fn().mockResolvedValue([{ id: 11 }, {}, { id: 22 }]),
      sendRuntime,
      sendTab,
    });
    const settings = { ...DEFAULT_EXTENSION_SETTINGS, themeMode: "dark" as const };

    await expect(publish(settings)).resolves.toBeUndefined();

    const notification = { type: "extension-settings-changed", payload: settings };
    expect(sendRuntime).toHaveBeenCalledWith(notification);
    expect(sendTab).toHaveBeenCalledTimes(2);
    expect(sendTab).toHaveBeenNthCalledWith(1, 11, notification);
    expect(sendTab).toHaveBeenNthCalledWith(2, 22, notification);
    expect(JSON.stringify(notification)).not.toContain("apiKey");
  });
});
