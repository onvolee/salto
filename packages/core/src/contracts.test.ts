import { describe, expect, expectTypeOf, it } from "vitest";

import {
  MEANING_RECALL_CARD_TYPE,
  VOCABULARY_FIELD_KEYS,
  type DictionaryAdapter,
  type LearningCard,
  type LlmClient,
  type VocabularyItem
} from "./index";

describe("@salto/core public contract", () => {
  it("exposes the fixed MVP vocabulary field keys", () => {
    expect(VOCABULARY_FIELD_KEYS).toEqual([
      "term",
      "phonetic",
      "partOfSpeech",
      "meaning",
      "examples",
      "synonyms",
      "wordForms"
    ]);
  });

  it("exposes only the MVP learning card type", () => {
    expect(MEANING_RECALL_CARD_TYPE).toBe("meaning-recall");
  });

  it("keeps extension adapters behind core ports", () => {
    expectTypeOf<LlmClient>().toHaveProperty("complete");
    expectTypeOf<DictionaryAdapter>().toHaveProperty("lookup");
    expectTypeOf<VocabularyItem>().toHaveProperty("canonicalKey").toEqualTypeOf<string>();
    expectTypeOf<LearningCard>().toHaveProperty("cardType").toEqualTypeOf<"meaning-recall">();
  });
});
