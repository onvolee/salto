import { describe, expect, expectTypeOf, it } from "vitest";

import {
  DEFAULT_EXTENSION_SETTINGS,
  DICTIONARY_FIELD_TYPES,
  createDefaultQueryTemplate,
  canonicalizeEnglishTerm,
  isValidQueryTemplate,
  MEANING_RECALL_CARD_TYPE,
  VOCABULARY_FIELD_KEYS,
  type DictionaryAdapter,
  type DictionaryFieldKey,
  type DictionaryQueryField,
  type DictionaryQueryFieldSpec,
  type LearningCard,
  type LlmClient,
  type PromptContext,
  type QueryFieldResult,
  type QuerySchemaFieldType,
  type VocabularyField,
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

  it("uses the dictionary contract as the query-template field source", () => {
    expect(DICTIONARY_FIELD_TYPES).toEqual({
      phonetic: "text",
      partOfSpeech: "text",
      meaning: "text",
      synonyms: "list",
      wordForms: "list"
    });
    expectTypeOf<DictionaryQueryField>().toEqualTypeOf<DictionaryFieldKey>();
    expectTypeOf<DictionaryQueryFieldSpec>()
      .toEqualTypeOf<typeof DICTIONARY_FIELD_TYPES>();
  });

  it("freezes query result and prompt context shapes", () => {
    expectTypeOf<QuerySchemaFieldType>().toEqualTypeOf<"text" | "list">();
    expectTypeOf<PromptContext>().toEqualTypeOf<{
      readonly selection: string;
      readonly sentence: string;
      readonly paragraphs: string;
      readonly targetLanguage: string;
      readonly webTitle: string;
      readonly webUrl: string;
      readonly webContent: string;
    }>();

    const results: readonly QueryFieldResult[] = [
      { fieldId: "translation", status: "ready", type: "text", value: "陌生的" },
      { fieldId: "notes", status: "ready", type: "list", value: ["adjective"] },
      { fieldId: "phonetic", status: "unavailable", reason: "not-found" },
      { fieldId: "meaning", status: "failed", error: { code: "provider-error", message: "Unavailable" } }
    ];

    expect(results.map((result) => result.status)).toEqual([
      "ready",
      "ready",
      "unavailable",
      "failed"
    ]);
    expectTypeOf<VocabularyField["vocabularyItemId"]>().toEqualTypeOf<string>();
  });

  it("provides the exact deterministic defaults", () => {
    expect(DEFAULT_EXTENSION_SETTINGS).toEqual({
      activeQueryTemplateId: "system-default",
      targetLanguage: "zh-CN",
      highlightEnabled: true,
      themeMode: "system",
      activeDictionaryProvider: "youdao-web"
    });
    expect(createDefaultQueryTemplate("2026-07-16T00:00:00.000Z")).toEqual({
      id: "system-default",
      name: "Default",
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
      fields: [
        {
          id: "system-default:translation",
          label: "Translation",
          source: "llm",
          type: "text",
          instruction:
            "Translate {{selection}} into {{targetLanguage}}. " +
            "Use {{sentence}} only when needed for disambiguation. " +
            "Return only the translation.",
          order: 0,
          enabled: true
        },
        {
          id: "system-default:key-points",
          label: "Key points",
          source: "llm",
          type: "list",
          instruction:
            "List the key meanings or usage notes for {{selection}} in " +
            "{{sentence}}. Write each item in {{targetLanguage}}.",
          order: 1,
          enabled: true
        }
      ]
    });
  });

  it("rejects incomplete query template fields and broken order sequences", () => {
    const template = createDefaultQueryTemplate("2026-07-16T00:00:00.000Z");

    expect(isValidQueryTemplate({
      ...template,
      fields: template.fields.map((field) => ({ ...field, order: field.order + 1 }))
    })).toBe(false);
    expect(isValidQueryTemplate({
      ...template,
      fields: [{ ...template.fields[0], label: "   " }, template.fields[1]]
    })).toBe(false);
    expect(isValidQueryTemplate({
      ...template,
      fields: [{ ...template.fields[0], instruction: "  " }, template.fields[1]]
    })).toBe(false);
    expect(isValidQueryTemplate({
      ...template,
      fields: template.fields.map((field) => ({ ...field, enabled: false }))
    })).toBe(false);
  });

  it("canonicalizes English terms without rewriting punctuation", () => {
    expect(canonicalizeEnglishTerm("  Running\n shoes  ")).toEqual({
      canonicalKey: "en:running shoes",
      term: "Running shoes"
    });
    expect(canonicalizeEnglishTerm("don't").canonicalKey).toBe("en:don't");
    expect(() => canonicalizeEnglishTerm(" ")).toThrowError("invalid-term");
    expect(() => canonicalizeEnglishTerm("x".repeat(501))).toThrowError("selection-too-long");
  });
});
