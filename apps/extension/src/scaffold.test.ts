import { describe, expect, expectTypeOf, it } from "vitest";

import type { DictionaryAdapter, LearningRepository, LlmClient, VocabularyRepository } from "@salto/core";

import { EXTENSION_ENTRYPOINTS, type ExtensionEntrypoint } from "./scaffold";
import type { BackgroundServiceDependencies } from "./services/background-services";

describe("@salto/extension scaffold", () => {
  it("declares the WXT entrypoints required by the MVP docs", () => {
    expect(EXTENSION_ENTRYPOINTS).toEqual(["background", "content", "options"]);
  });

  it("keeps background service dependencies on core ports", () => {
    expectTypeOf<ExtensionEntrypoint>().toEqualTypeOf<"background" | "content" | "options">();
    expectTypeOf<BackgroundServiceDependencies>().toHaveProperty("vocabularyRepository").toEqualTypeOf<VocabularyRepository>();
    expectTypeOf<BackgroundServiceDependencies>().toHaveProperty("learningRepository").toEqualTypeOf<LearningRepository>();
    expectTypeOf<BackgroundServiceDependencies>().toHaveProperty("llmClient").toEqualTypeOf<LlmClient>();
    expectTypeOf<BackgroundServiceDependencies>().toHaveProperty("dictionaryAdapters").toEqualTypeOf<readonly DictionaryAdapter[]>();
  });
});
