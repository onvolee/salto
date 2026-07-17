export type ThemeMode = "dark" | "system" | "light";

export type SaltoSettings = {
  themeMode: ThemeMode;
  language: "zh-CN" | "en-US";
  translationTemplate: "compact" | "context";
  anonymousDiagnostics: boolean;
};

export const SETTINGS_STORAGE_KEY = "salto-settings";

export const DEFAULT_SETTINGS: SaltoSettings = {
  themeMode: "system",
  language: "zh-CN",
  translationTemplate: "compact",
  anonymousDiagnostics: false,
};

type ChromeStorageLike = {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (value: Record<string, unknown>) => Promise<void>;
  onChanged?: {
    addListener: (listener: (changes: Record<string, { newValue?: unknown }>) => void) => void;
    removeListener: (listener: (changes: Record<string, { newValue?: unknown }>) => void) => void;
  };
};

function getExtensionStorage(): ChromeStorageLike | null {
  const extensionChrome = (globalThis as typeof globalThis & {
    chrome?: { storage?: { local?: ChromeStorageLike } };
  }).chrome;

  return extensionChrome?.storage?.local ?? null;
}

function normalizeSettings(value: unknown): SaltoSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_SETTINGS;
  }

  const candidate = value as Partial<SaltoSettings>;
  return {
    themeMode: candidate.themeMode && ["dark", "system", "light"].includes(candidate.themeMode)
      ? candidate.themeMode
      : DEFAULT_SETTINGS.themeMode,
    language: candidate.language && ["zh-CN", "en-US"].includes(candidate.language)
      ? candidate.language
      : DEFAULT_SETTINGS.language,
    translationTemplate: candidate.translationTemplate
      && ["compact", "context"].includes(candidate.translationTemplate)
      ? candidate.translationTemplate
      : DEFAULT_SETTINGS.translationTemplate,
    anonymousDiagnostics: typeof candidate.anonymousDiagnostics === "boolean"
      ? candidate.anonymousDiagnostics
      : DEFAULT_SETTINGS.anonymousDiagnostics,
  };
}

function containsLegacyLlmSettings(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && [
    "apiBaseUrl",
    "apiKey",
    "modelName",
    "provider",
  ].some((key) => key in value));
}

export async function loadSettings(): Promise<SaltoSettings> {
  const storage = getExtensionStorage();
  if (storage) {
    const result = await storage.get(SETTINGS_STORAGE_KEY);
    const stored = result[SETTINGS_STORAGE_KEY];
    const settings = normalizeSettings(stored);
    if (containsLegacyLlmSettings(stored)) {
      await storage.set({ [SETTINGS_STORAGE_KEY]: settings });
    }
    return settings;
  }

  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "null") as unknown;
    const settings = normalizeSettings(stored);
    if (containsLegacyLlmSettings(stored)) {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }
    return settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: SaltoSettings): Promise<void> {
  const storage = getExtensionStorage();
  if (storage) {
    await storage.set({ [SETTINGS_STORAGE_KEY]: settings });
    return;
  }

  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function subscribeToSettings(onChange: (settings: SaltoSettings) => void): () => void {
  const extensionChrome = (globalThis as typeof globalThis & {
    chrome?: { storage?: { onChanged?: ChromeStorageLike["onChanged"] } };
  }).chrome;
  const handleChromeChange = (changes: Record<string, { newValue?: unknown }>) => {
    const nextValue = changes[SETTINGS_STORAGE_KEY]?.newValue;
    if (nextValue) {
      onChange(normalizeSettings(nextValue));
    }
  };

  if (extensionChrome?.storage?.onChanged) {
    extensionChrome.storage.onChanged.addListener(handleChromeChange);
    return () => extensionChrome.storage?.onChanged?.removeListener(handleChromeChange);
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== SETTINGS_STORAGE_KEY || !event.newValue) {
      return;
    }

    try {
      onChange(normalizeSettings(JSON.parse(event.newValue)));
    } catch {
      // Ignore malformed values from other extension contexts.
    }
  };

  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}
