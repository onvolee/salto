import { SaltoDatabase } from "salto-src/db";
import { createOpenAiCompatibleClient } from "salto-src/llm/openai-compatible-client";
import { createOpenAiCompatibleQueryExecutor } from "salto-src/llm/openai-compatible-query-executor";
import { createLocalRepositories } from "salto-src/repositories";
import { createBackgroundServices } from "salto-src/services/background-services";
import { createRuntimeMessageListener } from "salto-src/services/runtime-listener";
import { normalizeLlmPublicConfig } from "@salto/core";

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
  const hasOriginPermission = (permissionOrigin: string) => {
    return browser.permissions.contains({ origins: [permissionOrigin] });
  };
  const queryExecutor = createOpenAiCompatibleQueryExecutor({
    llmSettings: repositories.llmSettings,
    createClient: createOpenAiCompatibleClient,
    hasOriginPermission,
  });
  const services = createBackgroundServices({
    repositories,
    queryExecutor,
    hasOriginPermission,
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
  ));
  browser.runtime.onInstalled.addListener(() => {
    void repositories.settings.ensureDefaults();
  });
});
