import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { SaltoDatabase } from "../db/database";
import { createLocalRepositories } from "../repositories/local-repositories";
import {
  LEGACY_SETTINGS_STORAGE_KEY,
  migrateLegacySettings,
  type LegacySettingsStorage,
} from "./legacy-settings-migration";

const databases: SaltoDatabase[] = [];

function setup(legacyValue: unknown) {
  const database = new SaltoDatabase(`legacy-settings-${crypto.randomUUID()}`);
  databases.push(database);
  const repositories = createLocalRepositories(database, {
    clock: () => "2026-07-19T00:00:00.000Z",
    createId: () => crypto.randomUUID(),
  });
  let stored = legacyValue;
  const storage: LegacySettingsStorage = {
    get: vi.fn(async () => ({ [LEGACY_SETTINGS_STORAGE_KEY]: stored })),
    remove: vi.fn(async () => { stored = undefined; }),
  };
  return { database, repositories, storage };
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (database) => {
    database.close();
    await database.delete();
  }));
});

describe("legacy extension settings migration", () => {
  it.each(["compact", "context"] as const)(
    "maps the %s preset once after durable persistence without touching vocabulary",
    async (translationTemplate) => {
      const { database, repositories, storage } = setup({
        language: "en-US",
        translationTemplate,
        themeMode: "dark",
        anonymousDiagnostics: true,
        apiKey: "legacy-secret",
      });
      await database.vocabularyItems.add({
        id: "kept-item",
        canonicalKey: "en:kept",
        term: "Kept",
        language: "en",
        sync: {
          createdAt: "2026-07-19T00:00:00.000Z",
          updatedAt: "2026-07-19T00:00:00.000Z",
          recordVersion: 1,
        },
      });

      await migrateLegacySettings(repositories.settings, storage);
      await migrateLegacySettings(repositories.settings, storage);

      await expect(repositories.settings.get()).resolves.toEqual({
        activeQueryTemplateId: "system-default",
        targetLanguage: "en-US",
        highlightEnabled: true,
        highlightSameWords: false,
        themeMode: "dark",
        activeDictionaryProvider: "youdao-web",
        panelWidth: 360,
        panelHeight: 220,
      });
      expect(await database.queryTemplates.count()).toBe(1);
      expect(await database.vocabularyItems.get("kept-item")).toEqual(
        expect.objectContaining({ term: "Kept" }),
      );
      expect(storage.remove).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(await repositories.settings.get())).not.toContain("legacy-secret");
    },
  );

  it("keeps the legacy key when the durable write fails so migration remains retryable", async () => {
    const { repositories, storage } = setup({
      language: "zh-CN",
      translationTemplate: "compact",
      themeMode: "light",
    });
    vi.spyOn(repositories.settings, "saveLegacySettingsMigration")
      .mockRejectedValueOnce(new Error("IndexedDB unavailable"));

    await expect(migrateLegacySettings(repositories.settings, storage))
      .rejects.toThrow("IndexedDB unavailable");

    expect(storage.remove).not.toHaveBeenCalled();
    expect((await repositories.settings.getMigrationState()).legacySettingsCompleted).toBe(false);
  });

  it("records completion before cleanup and never reapplies stale legacy values on retry", async () => {
    const { database, repositories, storage } = setup({
      language: "en-US",
      translationTemplate: "context",
      themeMode: "dark",
      apiKey: "legacy-secret",
    });
    vi.mocked(storage.remove).mockRejectedValueOnce(new Error("Storage cleanup unavailable"));
    const migrate = vi.spyOn(repositories.settings, "saveLegacySettingsMigration");

    await expect(migrateLegacySettings(repositories.settings, storage))
      .rejects.toThrow("Storage cleanup unavailable");

    expect(await repositories.settings.getMigrationState()).toEqual({
      legacySettingsCompleted: true,
    });
    expect(await repositories.settings.get()).toEqual({
      activeQueryTemplateId: "system-default",
      targetLanguage: "en-US",
      highlightEnabled: true,
      highlightSameWords: false,
      themeMode: "dark",
      activeDictionaryProvider: "youdao-web",
      panelWidth: 360,
      panelHeight: 220,
    });
    expect(await database.settings.get("extension")).toEqual(expect.objectContaining({
      legacySettingsMigrationCompleted: true,
    }));
    expect(JSON.stringify(await repositories.settings.get())).not.toContain("Migration");
    expect(JSON.stringify(await repositories.settings.get())).not.toContain("legacy-secret");

    const userSettings = {
      activeQueryTemplateId: "system-default",
      targetLanguage: "zh-CN",
      highlightEnabled: false,
      highlightSameWords: false,
      themeMode: "light" as const,
      activeDictionaryProvider: "youdao-web" as const,
      panelWidth: 360,
      panelHeight: 220,
    };
    await repositories.settings.save(userSettings);
    expect(await database.settings.get("extension")).toEqual(expect.objectContaining({
      legacySettingsMigrationCompleted: true,
      targetLanguage: "zh-CN",
      highlightEnabled: false,
      themeMode: "light",
    }));

    await expect(migrateLegacySettings(repositories.settings, storage)).resolves.toEqual(userSettings);

    expect(migrate).toHaveBeenCalledOnce();
    expect(storage.remove).toHaveBeenCalledTimes(2);
    expect(await repositories.settings.get()).toEqual(userSettings);
  });
});
