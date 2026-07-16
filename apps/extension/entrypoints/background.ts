import { SaltoDatabase } from "salto-src/db";
import { createLocalRepositories } from "salto-src/repositories";
import {
  createBackgroundServices,
  type QueryExecutor
} from "salto-src/services/background-services";
import { createRuntimeMessageListener } from "salto-src/services/runtime-listener";

function createId(): string {
  return crypto.randomUUID();
}

function createProductionQueryExecutor(): QueryExecutor {
  return {
    async execute() {
      throw new Error("Production providers are not configured");
    }
  };
}

function createDevelopmentQueryExecutor(): QueryExecutor {
  return {
    async execute(template, context) {
      const { createFakeQueryExecutor } = await import("salto-src/services/fake-query-executor");
      return createFakeQueryExecutor().execute(template, context);
    }
  };
}

export default defineBackground(() => {
  const database = new SaltoDatabase();
  const repositories = createLocalRepositories(database, {
    clock: () => new Date().toISOString(),
    createId
  });
  const services = createBackgroundServices({
    repositories,
    queryExecutor: import.meta.env.MODE === "development"
      ? createDevelopmentQueryExecutor()
      : createProductionQueryExecutor()
  });

  browser.runtime.onMessage.addListener(createRuntimeMessageListener(services));
  browser.runtime.onInstalled.addListener(() => {
    void repositories.settings.ensureDefaults();
  });
});
