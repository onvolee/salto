import type { ExtensionSettings } from "@salto/core";

import type { SettingsRepository } from "../repositories/local-repositories";

export const LEGACY_SETTINGS_STORAGE_KEY = "salto-settings";

export interface LegacySettingsStorage {
  get(key: string): Promise<Record<string, unknown>>;
  remove(key: string): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isThemeMode(value: unknown): value is ExtensionSettings["themeMode"] {
  return value === "system" || value === "light" || value === "dark";
}

function isLegacyLanguage(value: unknown): value is "zh-CN" | "en-US" {
  return value === "zh-CN" || value === "en-US";
}

function isLegacyTemplatePreset(value: unknown): value is "compact" | "context" {
  return value === "compact" || value === "context";
}

export async function migrateLegacySettings(
  settingsRepository: SettingsRepository,
  storage: LegacySettingsStorage,
): Promise<ExtensionSettings> {
  const stored = await storage.get(LEGACY_SETTINGS_STORAGE_KEY);
  const hasLegacyValue = Object.prototype.hasOwnProperty.call(
    stored,
    LEGACY_SETTINGS_STORAGE_KEY,
  ) && stored[LEGACY_SETTINGS_STORAGE_KEY] !== undefined;
  const current = await settingsRepository.get();

  if (!hasLegacyValue) {
    return current;
  }

  const migrationState = await settingsRepository.getMigrationState();
  if (migrationState.legacySettingsCompleted) {
    await storage.remove(LEGACY_SETTINGS_STORAGE_KEY);
    return current;
  }

  const legacy = stored[LEGACY_SETTINGS_STORAGE_KEY];
  const next: ExtensionSettings = {
    ...current,
    activeQueryTemplateId: isRecord(legacy)
      && isLegacyTemplatePreset(legacy.translationTemplate)
      ? "system-default"
      : current.activeQueryTemplateId,
    targetLanguage: isRecord(legacy) && isLegacyLanguage(legacy.language)
      ? legacy.language
      : current.targetLanguage,
    themeMode: isRecord(legacy) && isThemeMode(legacy.themeMode)
      ? legacy.themeMode
      : current.themeMode,
    activeDictionaryProvider: "youdao-web",
  };

  const migrated = await settingsRepository.saveLegacySettingsMigration(next);
  await storage.remove(LEGACY_SETTINGS_STORAGE_KEY);
  return migrated;
}
