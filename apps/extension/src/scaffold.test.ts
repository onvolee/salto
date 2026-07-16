import { describe, expect, expectTypeOf, it } from "vitest";

import { EXTENSION_ENTRYPOINTS, type ExtensionEntrypoint } from "./scaffold";
import type { LocalRepositories } from "./repositories";
import type { BackgroundServiceDependencies, QueryExecutor } from "./services/background-services";

describe("@salto/extension scaffold", () => {
  it("declares the WXT entrypoints required by the MVP docs", () => {
    expect(EXTENSION_ENTRYPOINTS).toEqual(["background", "content", "options"]);
  });

  it("keeps background service dependencies behind repositories and query execution", () => {
    expectTypeOf<ExtensionEntrypoint>().toEqualTypeOf<"background" | "content" | "options">();
    expectTypeOf<BackgroundServiceDependencies>().toHaveProperty("repositories").toEqualTypeOf<LocalRepositories>();
    expectTypeOf<BackgroundServiceDependencies>().toHaveProperty("queryExecutor").toEqualTypeOf<QueryExecutor>();
  });
});
