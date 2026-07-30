import { describe, expect, expectTypeOf, it } from "vitest";

import {
  DEFAULT_EXTENSION_SETTINGS,
  DICTIONARY_FIELD_TYPES,
  DICTIONARY_QUERY_FIELD_TYPES,
  createTemplateFieldSnapshot,
  createDefaultQueryTemplate,
  createDefaultTemplateFieldDefinitions,
  canonicalizeEnglishTerm,
  findSavedTermMatches,
  isValidQueryTemplate,
  MEANING_RECALL_CARD_TYPE,
  normalizeSavedTerms,
  VOCABULARY_FIELD_KEYS,
  type DictionaryAdapter,
  type DictionaryPreviewAdapter,
  type DictionaryFieldKey,
  type DictionaryQueryField,
  type DictionaryQueryFieldSpec,
  type LearningCard,
  type LlmClient,
  type PromptContext,
  type QueryFieldResult,
  type QuerySchemaFieldType,
  type TemplateFieldDefinition,
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
    expectTypeOf<DictionaryPreviewAdapter>().toHaveProperty("preview");
    expectTypeOf<VocabularyItem>().toHaveProperty("canonicalKey").toEqualTypeOf<string>();
    expectTypeOf<LearningCard>().toHaveProperty("cardType").toEqualTypeOf<"meaning-recall">();
  });

  it("exposes the seven dictionary fields available to query templates", () => {
    expect(DICTIONARY_FIELD_TYPES).toEqual({
      basicDefinition: "text",
      phonetic: "text",
      partOfSpeech: "text",
      meaning: "text",
      synonyms: "list",
      wordForms: "list",
      examples: "examples",
    });
    expect(DICTIONARY_QUERY_FIELD_TYPES).toEqual({
      translation: "text",
      basicDefinition: "text",
      phonetic: "text",
      partOfSpeech: "text",
      synonyms: "list",
      wordForms: "list",
      examples: "examples",
    });
    expectTypeOf<DictionaryFieldKey>().toMatchTypeOf<DictionaryQueryField>();
    expectTypeOf<DictionaryQueryFieldSpec>()
      .toEqualTypeOf<typeof DICTIONARY_QUERY_FIELD_TYPES>();
  });

  it("freezes query result and prompt context shapes", () => {
    expectTypeOf<QuerySchemaFieldType>().toEqualTypeOf<"text" | "list" | "examples">();
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
      {
        fieldId: "examples",
        status: "ready",
        type: "examples",
        value: [{ english: "An example helps.", chinese: "例子会有帮助。", source: "词典" }],
      },
      { fieldId: "phonetic", status: "unavailable", reason: "not-found" },
      { fieldId: "meaning", status: "failed", error: { code: "provider-error", message: "Unavailable" } }
    ];

    expect(results.map((result) => result.status)).toEqual([
      "ready",
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
      highlightSameWords: false,
      themeMode: "system",
      activeDictionaryProvider: "youdao-web",
      panelWidth: 360,
      panelHeight: 220,
    });
    expect(createDefaultTemplateFieldDefinitions("2026-07-16T00:00:00.000Z")).toEqual([
      {
        id: "system-field:translation",
        label: "翻译",
        source: "dictionary",
        type: "text",
        dictionaryField: "translation",
        createdAt: "2026-07-16T00:00:00.000Z",
        updatedAt: "2026-07-16T00:00:00.000Z",
      },
      {
        id: "system-field:phonetic",
        label: "音标",
        source: "dictionary",
        type: "text",
        dictionaryField: "phonetic",
        createdAt: "2026-07-16T00:00:00.000Z",
        updatedAt: "2026-07-16T00:00:00.000Z",
      },
      {
        id: "system-field:part-of-speech",
        label: "词性",
        source: "dictionary",
        type: "text",
        dictionaryField: "partOfSpeech",
        createdAt: "2026-07-16T00:00:00.000Z",
        updatedAt: "2026-07-16T00:00:00.000Z",
      },
    ]);
    expect(createDefaultQueryTemplate("2026-07-16T00:00:00.000Z")).toEqual({
      id: "system-default",
      name: "Default",
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
      fields: [
        {
          id: "system-default:translation",
          definitionId: "system-field:translation",
          content: {
            label: "翻译",
            source: "dictionary",
            type: "text",
            dictionaryField: "translation",
          },
          order: 0,
          enabled: true
        },
        {
          id: "system-default:phonetic",
          definitionId: "system-field:phonetic",
          content: {
            label: "音标",
            source: "dictionary",
            type: "text",
            dictionaryField: "phonetic",
          },
          order: 1,
          enabled: true
        },
        {
          id: "system-default:part-of-speech",
          definitionId: "system-field:part-of-speech",
          content: {
            label: "词性",
            source: "dictionary",
            type: "text",
            dictionaryField: "partOfSpeech",
          },
          order: 2,
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
      fields: [{
        ...template.fields[0],
        content: { ...template.fields[0]!.content, label: "   " },
      }, template.fields[1]]
    })).toBe(false);
    expect(isValidQueryTemplate({
      ...template,
      fields: [{
        ...template.fields[0],
        content: { ...template.fields[0]!.content, instruction: "  " },
      }, template.fields[1]]
    })).toBe(false);
    expect(isValidQueryTemplate({
      ...template,
      fields: template.fields.map((field) => ({ ...field, enabled: false }))
    })).toBe(false);
  });

  it("creates independent field snapshots from one reusable definition", () => {
    const definition: TemplateFieldDefinition = {
      id: "definition-1",
      label: "Meaning",
      description: "A concise meaning",
      source: "dictionary",
      dictionaryField: "meaning",
      type: "text",
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
    };

    const first = createTemplateFieldSnapshot(definition, "result-1", 0);
    const second = createTemplateFieldSnapshot(definition, "result-2", 1);
    const editedDefinition = { ...definition, label: "Edited later" };

    expect(first).toEqual({
      id: "result-1",
      definitionId: "definition-1",
      content: {
        label: "Meaning",
        description: "A concise meaning",
        source: "dictionary",
        dictionaryField: "meaning",
        type: "text",
      },
      order: 0,
      enabled: true,
    });
    expect(second.id).toBe("result-2");
    expect(second.content).not.toBe(first.content);
    expect(first.content.label).toBe("Meaning");
    expect(editedDefinition.label).toBe("Edited later");
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

  it("exposes the storage-neutral saved-term matching seam", () => {
    expect(normalizeSavedTerms([" Running "])).toEqual([
      { canonicalKey: "en:running", term: "Running" }
    ]);
    expect(findSavedTermMatches("RUNNING", ["running"])).toEqual([
      { canonicalKey: "en:running", start: 0, end: 7 }
    ]);
  });
});
