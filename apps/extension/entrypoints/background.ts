import { SaltoDatabase } from "salto-src/db";
import { createDictionaryEnrichmentSource } from "salto-src/enrichment/dictionary-enrichment-source";
import { createDictionaryQueryExecutor } from "salto-src/dictionary/dictionary-query-executor";
import { createYoudaoWebAdapter } from "salto-src/dictionary/youdao-web-adapter";
import { createEnrichmentQueue } from "salto-src/enrichment/enrichment-queue";
import { createLlmEnrichmentSource } from "salto-src/enrichment/llm-enrichment-source";
import { createOpenAiCompatibleClient } from "salto-src/llm/openai-compatible-client";
import { createOpenAiCompatibleQueryExecutor } from "salto-src/llm/openai-compatible-query-executor";
import { createLocalRepositories } from "salto-src/repositories";
import { createBackgroundServices } from "salto-src/services/background-services";
import { createRuntimeMessageListener } from "salto-src/services/runtime-listener";
import {
  migrateLegacySettings,
} from "salto-src/settings/legacy-settings-migration";
import { createSettingsNotificationPublisher } from "salto-src/settings/settings-notifications";
import { createDictionaryClient, normalizeLlmPublicConfig } from "@salto/core";

function createId(): string {
  return crypto.randomUUID();
}

class ProviderSetupError extends Error {
  constructor(
    readonly code: "not-configured" | "permission-denied",
    message: string,
  ) {
    super(message);
    this.name = "ProviderSetupError";
  }
}

export default defineBackground(() => {
  const database = new SaltoDatabase();
  const repositories = createLocalRepositories(database, {
    clock: () => new Date().toISOString(),
    createId
  });
  let settingsReady: Promise<void> | undefined;
  const prepareSettings = () => {
    settingsReady ??= migrateLegacySettings(repositories.settings, {
      async get(key) {
        return browser.storage.local.get(key) as Promise<Record<string, unknown>>;
      },
      async remove(key) {
        await browser.storage.local.remove(key);
      },
    }).then(() => undefined).catch((error: unknown) => {
      settingsReady = undefined;
      throw error;
    });
    return settingsReady;
  };
  const notifySettingsChanged = createSettingsNotificationPublisher({
    queryTabs: () => browser.tabs.query({}),
    sendRuntime: (notification) => browser.runtime.sendMessage(notification),
    sendTab: (tabId, notification) => browser.tabs.sendMessage(tabId, notification),
  });
  const hasOriginPermission = (permissionOrigin: string) => {
    return browser.permissions.contains({ origins: [permissionOrigin] });
  };
  const llmQueryExecutor = createOpenAiCompatibleQueryExecutor({
    llmSettings: repositories.llmSettings,
    createClient: createOpenAiCompatibleClient,
    hasOriginPermission,
  });
  const dictionaryAdapter = createYoudaoWebAdapter({
    hasOriginPermission,
  });
  const dictionaryClient = createDictionaryClient(dictionaryAdapter);
  const queryExecutor = createDictionaryQueryExecutor({
    dictionaryClient,
    llmExecutor: llmQueryExecutor,
  });
  const dictionarySource = createDictionaryEnrichmentSource({
    settings: repositories.settings,
    dictionaryClient,
    useDeterministicFake: process.env.NODE_ENV === "development",
  });
  const llmSource = createLlmEnrichmentSource({
    llmSettings: repositories.llmSettings,
    createClient: createOpenAiCompatibleClient,
    hasOriginPermission,
  });
  const enrichmentQueue = createEnrichmentQueue({
    database,
    repositories: {
      enrichmentJobs: repositories.enrichmentJobs,
      learning: repositories.learning,
      vocabulary: repositories.vocabulary
    },
    sources: [dictionarySource, llmSource],
    clock: () => new Date().toISOString(),
    createId,
    maxAttempts: 5,
    initialBackoffMs: 5_000,
    maxBackoffMs: 300_000,
    claimTimeoutMs: 60_000,
    scheduleAlarm(when) {
      void browser.alarms?.create?.("salto-enrichment-queue", { when: new Date(when).getTime() });
    }
  });
  const services = createBackgroundServices({
    repositories,
    saveVocabulary: repositories.saveVocabulary,
    enrichmentQueue,
    queryExecutor,
    dictionaryAdapter,
    hasOriginPermission,
    prepareSettings,
    notifySettingsChanged,
    async testLlmConnection() {
      const credentials = await repositories.llmSettings.getCredentials();
      if (!credentials) {
        throw new ProviderSetupError("not-configured", "Configure an LLM provider first");
      }
      const normalized = normalizeLlmPublicConfig(credentials.config);
      if (!await hasOriginPermission(normalized.permissionOrigin)) {
        throw new ProviderSetupError(
          "permission-denied",
          "Provider permission is not granted",
        );
      }
      await createOpenAiCompatibleClient(
        normalized.config,
        credentials.secret,
      ).testConnection();
    },
  });

  browser.runtime.onMessage.addListener(createRuntimeMessageListener(
    services,
    browser.runtime.getURL(""),
    browser.runtime.getURL("/setting.html"),
  ));
  browser.runtime.onInstalled.addListener(() => {
    void prepareSettings().catch(() => {});
  });
  browser.runtime.onStartup.addListener(() => {
    void enrichmentQueue.recover().then(() => enrichmentQueue.wake());
  });
  browser.alarms?.onAlarm?.addListener((alarm) => {
    if (alarm.name === "salto-enrichment-queue") {
      void enrichmentQueue.recover().then(() => enrichmentQueue.wake());
    }
  });

  void prepareSettings().catch(() => {});
  void enrichmentQueue.recover().then(() => enrichmentQueue.wake());
});
