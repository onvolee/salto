import {
  DEFAULT_EXTENSION_SETTINGS,
  isExtensionNotification,
  type ExtensionRequest,
  type ExtensionResponse,
  type ExtensionSettings,
} from "@salto/core";

export type ThemeMode = ExtensionSettings["themeMode"];
export type SaltoSettings = ExtensionSettings;

export const DEFAULT_SETTINGS: SaltoSettings = DEFAULT_EXTENSION_SETTINGS;

class SettingsClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettingsClientError";
  }
}

async function send(request: ExtensionRequest): Promise<ExtensionResponse> {
  return browser.runtime.sendMessage(request) as Promise<ExtensionResponse>;
}

function settingsData(
  response: ExtensionResponse,
  type: "get-extension-settings" | "save-extension-settings",
): ExtensionSettings {
  if (!response.ok) {
    throw new SettingsClientError(response.error.message);
  }
  if (response.type !== type) {
    throw new SettingsClientError("The background returned an unexpected settings response");
  }
  return response.data;
}

export async function loadSettings(): Promise<SaltoSettings> {
  if (typeof browser === "undefined") {
    return DEFAULT_SETTINGS;
  }
  return settingsData(await send({ type: "get-extension-settings" }), "get-extension-settings");
}

export async function saveSettings(settings: SaltoSettings): Promise<SaltoSettings> {
  if (typeof browser === "undefined") {
    return settings;
  }
  return settingsData(
    await send({ type: "save-extension-settings", payload: settings }),
    "save-extension-settings",
  );
}

export function subscribeToSettings(onChange: (settings: SaltoSettings) => void): () => void {
  if (typeof browser === "undefined") {
    return () => {};
  }

  const listener = (message: unknown) => {
    if (isExtensionNotification(message) && message.type === "extension-settings-changed") {
      onChange(message.payload);
    }
  };
  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}
