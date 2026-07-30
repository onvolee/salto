import { describe, expect, it, vi } from "vitest";

import {
  createDefaultQueryTemplate,
  createDictionaryClient,
  createFakeDictionaryAdapter,
  DictionaryLookupError,
  type DictionaryAdapter,
  type PromptContext,
  type QueryTemplate,
} from "@salto/core";

import type { QueryExecutor } from "../services/background-services";
import { createDictionaryQueryExecutor } from "./dictionary-query-executor";

const context: PromptContext = {
  selection: "bank",
  sentence: "She sat on the bank.",
  paragraphs: "",
  targetLanguage: "zh-CN",
  webTitle: "",
  webUrl: "https://example.com",
  webContent: "",
};

const template: QueryTemplate = {
  id: "mixed-template",
  name: "Mixed",
  createdAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z",
  fields: [
    {
      id: "meaning",
      definitionId: "definition-meaning",
      content: { label: "Meaning", source: "dictionary", dictionaryField: "meaning", type: "text" },
      order: 2,
      enabled: true,
    },
    {
      id: "translation",
      definitionId: "definition-translation",
      content: { label: "Translation", source: "llm", type: "text", instruction: "Translate {{selection}}." },
      order: 0,
      enabled: true,
    },
    {
      id: "synonyms",
      definitionId: "definition-synonyms",
      content: { label: "Synonyms", source: "dictionary", dictionaryField: "synonyms", type: "list" },
      order: 1,
      enabled: true,
    },
    {
      id: "disabled-phonetic",
      definitionId: "definition-phonetic",
      content: { label: "Phonetic", source: "dictionary", dictionaryField: "phonetic", type: "text" },
      order: 3,
      enabled: false,
    },
  ],
};

function createFakeAdapter(
  lookup: DictionaryAdapter["lookup"],
): DictionaryAdapter {
  return {
    capabilities: {
      providerId: "youdao-web",
      supportedLanguages: ["en"],
      supportedFields: ["phonetic", "partOfSpeech", "meaning", "synonyms", "wordForms"],
    },
    lookup,
  };
}

describe("dictionary query executor", () => {
  it("executes dictionary translation and structured fields without an LLM configuration", async () => {
    const defaults = createDefaultQueryTemplate("2026-07-30T00:00:00.000Z");
    const dictionaryTemplate: QueryTemplate = {
      ...defaults,
      fields: [
        ...defaults.fields,
        {
          id: "basic-definition",
          definitionId: "definition-basic-definition",
          content: {
            label: "基础释义",
            source: "dictionary",
            dictionaryField: "basicDefinition",
            type: "text",
          },
          order: 3,
          enabled: true,
        },
        {
          id: "examples",
          definitionId: "definition-examples",
          content: {
            label: "例句",
            source: "dictionary",
            dictionaryField: "examples",
            type: "examples",
          },
          order: 4,
          enabled: true,
        },
      ],
    };
    const llmExecutor: QueryExecutor = { execute: vi.fn() };
    const executor = createDictionaryQueryExecutor({
      dictionaryClient: createDictionaryClient(createFakeDictionaryAdapter({
        providerId: "youdao-web",
        supportedLanguages: ["en"],
        fixtures: [{
          request: { term: "bank", language: "en" },
          fields: {
            basicDefinition: "n. 河岸\nv. 把钱存入银行",
            phonetic: "/baenk/",
            partOfSpeech: "noun, verb",
            meaning: "河岸\n把钱存入银行",
            synonyms: ["shore"],
            wordForms: ["banks", "banked", "banking"],
            examples: [{
              english: "She sat on the bank.",
              chinese: "她坐在河岸上。",
              source: "Example dictionary",
            }],
          },
        }],
      })),
      llmExecutor,
    });

    await expect(executor.execute(dictionaryTemplate, context)).resolves.toEqual([
      { fieldId: "system-default:translation", status: "ready", type: "text", value: "河岸\n把钱存入银行" },
      { fieldId: "system-default:phonetic", status: "ready", type: "text", value: "/baenk/" },
      { fieldId: "system-default:part-of-speech", status: "ready", type: "text", value: "noun, verb" },
      { fieldId: "basic-definition", status: "ready", type: "text", value: "n. 河岸\nv. 把钱存入银行" },
      {
        fieldId: "examples",
        status: "ready",
        type: "examples",
        value: [{
          english: "She sat on the bank.",
          chinese: "她坐在河岸上。",
          source: "Example dictionary",
        }],
      },
    ]);
    expect(llmExecutor.execute).not.toHaveBeenCalled();
  });

  it("shares one lookup across enabled dictionary fields and preserves schema order", async () => {
    const lookup = vi.fn<DictionaryAdapter["lookup"]>().mockResolvedValue({
      providerId: "youdao-web",
      term: "bank",
      language: "en",
      fields: {
        basicDefinition: { status: "unavailable", type: "text", reason: "unsupported" },
        phonetic: { status: "unavailable", type: "text", reason: "missing" },
        partOfSpeech: { status: "unavailable", type: "text", reason: "missing" },
        meaning: { status: "ready", type: "text", value: "河岸" },
        synonyms: { status: "ready", type: "list", value: ["shore"] },
        wordForms: { status: "unavailable", type: "list", reason: "missing" },
        examples: { status: "unavailable", type: "examples", reason: "unsupported" },
      },
    });
    const llmExecutor: QueryExecutor = {
      execute: vi.fn().mockResolvedValue([
        { fieldId: "translation", status: "ready", type: "text", value: "银行" },
      ]),
    };
    const executor = createDictionaryQueryExecutor({
      dictionaryClient: createDictionaryClient(createFakeAdapter(lookup)),
      llmExecutor,
    });
    const controller = new AbortController();

    await expect(executor.execute(template, context, controller.signal)).resolves.toEqual([
      { fieldId: "translation", status: "ready", type: "text", value: "银行" },
      { fieldId: "synonyms", status: "ready", type: "list", value: ["shore"] },
      { fieldId: "meaning", status: "ready", type: "text", value: "河岸" },
    ]);
    expect(lookup).toHaveBeenCalledOnce();
    expect(lookup).toHaveBeenCalledWith(
      { term: "bank", language: "en" },
      controller.signal,
    );
  });

  it("keeps ready LLM fields when the dictionary provider fails", async () => {
    const lookup = vi.fn<DictionaryAdapter["lookup"]>()
      .mockRejectedValue(new DictionaryLookupError("timeout"));
    const llmExecutor: QueryExecutor = {
      execute: vi.fn().mockResolvedValue([
        { fieldId: "translation", status: "ready", type: "text", value: "银行" },
      ]),
    };
    const executor = createDictionaryQueryExecutor({
      dictionaryClient: createDictionaryClient(createFakeAdapter(lookup)),
      llmExecutor,
    });

    await expect(executor.execute(template, context)).resolves.toEqual([
      { fieldId: "translation", status: "ready", type: "text", value: "银行" },
      {
        fieldId: "synonyms",
        status: "failed",
        error: {
          code: "dictionary-timeout",
          message: "The dictionary lookup timed out",
        },
      },
      {
        fieldId: "meaning",
        status: "failed",
        error: {
          code: "dictionary-timeout",
          message: "The dictionary lookup timed out",
        },
      },
    ]);
  });

  it("keeps normalized dictionary fields when LLM execution rejects", async () => {
    const lookup = vi.fn<DictionaryAdapter["lookup"]>().mockResolvedValue({
      providerId: "youdao-web",
      term: "bank",
      language: "en",
      fields: {
        basicDefinition: { status: "unavailable", type: "text", reason: "unsupported" },
        phonetic: { status: "unavailable", type: "text", reason: "missing" },
        partOfSpeech: { status: "unavailable", type: "text", reason: "missing" },
        meaning: { status: "ready", type: "text", value: "河岸" },
        synonyms: { status: "unavailable", type: "list", reason: "missing" },
        wordForms: { status: "unavailable", type: "list", reason: "missing" },
        examples: { status: "unavailable", type: "examples", reason: "unsupported" },
      },
    });
    const llmExecutor: QueryExecutor = {
      execute: vi.fn().mockRejectedValue(new Error("secret upstream response")),
    };
    const executor = createDictionaryQueryExecutor({
      dictionaryClient: createDictionaryClient(createFakeAdapter(lookup)),
      llmExecutor,
    });

    await expect(executor.execute(template, context)).resolves.toEqual([
      {
        fieldId: "translation",
        status: "failed",
        error: {
          code: "llm-query",
          message: "The LLM query could not be completed",
        },
      },
      { fieldId: "synonyms", status: "unavailable", reason: "missing" },
      { fieldId: "meaning", status: "ready", type: "text", value: "河岸" },
    ]);
  });

  it("does not look up disabled dictionary fields", async () => {
    const lookup = vi.fn<DictionaryAdapter["lookup"]>();
    const llmExecutor: QueryExecutor = {
      execute: vi.fn().mockResolvedValue([
        { fieldId: "translation", status: "ready", type: "text", value: "银行" },
      ]),
    };
    const executor = createDictionaryQueryExecutor({
      dictionaryClient: createDictionaryClient(createFakeAdapter(lookup)),
      llmExecutor,
    });
    const llmOnlyTemplate: QueryTemplate = {
      ...template,
      fields: template.fields.map((field) => (
        field.content.source === "dictionary" ? { ...field, enabled: false } : field
      )),
    };

    await expect(executor.execute(llmOnlyTemplate, context)).resolves.toEqual([
      { fieldId: "translation", status: "ready", type: "text", value: "银行" },
    ]);
    expect(lookup).not.toHaveBeenCalled();
  });
});
