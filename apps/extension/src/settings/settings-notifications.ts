import type {
  ExtensionNotification,
  ExtensionSettings,
} from "@salto/core";

type SettingsNotificationTransport = {
  readonly queryTabs: () => Promise<readonly { readonly id?: number }[]>;
  readonly sendRuntime: (notification: ExtensionNotification) => Promise<unknown>;
  readonly sendTab: (tabId: number, notification: ExtensionNotification) => Promise<unknown>;
};

export function createSettingsNotificationPublisher(
  transport: SettingsNotificationTransport,
): (settings: ExtensionSettings) => Promise<void> {
  return async (settings) => {
    const notification: ExtensionNotification = {
      type: "extension-settings-changed",
      payload: settings,
    };
    const tabs = await transport.queryTabs().catch(() => []);
    await Promise.allSettled([
      transport.sendRuntime(notification),
      ...tabs.flatMap(({ id }) => id === undefined
        ? []
        : [transport.sendTab(id, notification)]),
    ]);
  };
}
