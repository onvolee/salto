import { describe, expect, it, vi } from "vitest";

import {
  createDictionaryClient,
  DictionaryLookupError,
  type DictionaryAdapter,
  type EnrichmentJob,
} from "@salto/core";

import { createDictionaryEnrichmentSource } from "./dictionary-enrichment-source";
import type { EnrichmentBatchRequest } from "./types";

const activeSettings = {
  activeQueryTemplateId: "system-default",
  targetLanguage: "zh-CN",
  highlightEnabled: true,
  themeMode: "system" as const,
  activeDictionaryProvider: "youdao-web" as const,
};

function job(
  fieldKey: "phonetic" | "meaning" | "synonyms" | "examples",
  source: "dictionary" | "llm",
): EnrichmentJob {
  return {
    id: `item-1:${fieldKey}:job`,
    vocabularyItemId: "item-1",
    fieldKey,
    source,
    status: "running",
    attempts: 1,
    nextRunAt: "2026-07-20T00:01:00.000Z",
  } as EnrichmentJob;
}

const request: EnrichmentBatchRequest = {
  vocabularyItemId: "item-1",
  term: "bank",
  language: "en",
  jobs: [
    job("synonyms", "dictionary"),
    job("examples", "llm"),
    job("phonetic", "dictionary"),
    job("meaning", "dictionary"),
  ],
};

function createFakeAdapter(lookup: DictionaryAdapter["lookup"]): DictionaryAdapter {
  return {
    capabilities: {
      providerId: "youdao-web",
      supportedLanguages: ["en"],
      supportedFields: ["phonetic", "partOfSpeech", "meaning", "synonyms", "wordForms"],
    },
    lookup,
  };
}

describe("dictionary enrichment source", () => {
  it("maps one normalized lookup across the item's dictionary jobs", async () => {
    const lookup = vi.fn<DictionaryAdapter["lookup"]>().mockResolvedValue({
      providerId: "youdao-web",
      term: "bank",
      language: "en",
      fields: {
        phonetic: { status: "ready", type: "text", value: "/bæŋk/" },
        partOfSpeech: { status: "unavailable", type: "text", reason: "missing" },
        meaning: { status: "unavailable", type: "text", reason: "missing" },
        synonyms: { status: "ready", type: "list", value: ["shore"] },
        wordForms: { status: "unavailable", type: "list", reason: "missing" },
      },
    });
    const source = createDictionaryEnrichmentSource({
      settings: { getActive: vi.fn().mockResolvedValue({ settings: activeSettings }) },
      dictionaryClient: createDictionaryClient(createFakeAdapter(lookup)),
    });

    await expect(source.executeBatch(request)).resolves.toEqual([
      {
        jobId: "item-1:synonyms:job",
        fieldKey: "synonyms",
        status: "ready",
        value: ["shore"],
      },
      {
        jobId: "item-1:phonetic:job",
        fieldKey: "phonetic",
        status: "ready",
        value: "/bæŋk/",
      },
      {
        jobId: "item-1:meaning:job",
        fieldKey: "meaning",
        status: "unavailable",
      },
    ]);
    expect(lookup).toHaveBeenCalledOnce();
    expect(lookup).toHaveBeenCalledWith(
      { term: "bank", language: "en" },
      expect.any(AbortSignal),
    );
  });

  it("returns one failed result per dictionary job when Youdao fails", async () => {
    const lookup = vi.fn<DictionaryAdapter["lookup"]>()
      .mockRejectedValue(new DictionaryLookupError("network"));
    const source = createDictionaryEnrichmentSource({
      settings: { getActive: vi.fn().mockResolvedValue({ settings: activeSettings }) },
      dictionaryClient: createDictionaryClient(createFakeAdapter(lookup)),
    });

    await expect(source.executeBatch(request)).resolves.toEqual([
      {
        jobId: "item-1:synonyms:job",
        fieldKey: "synonyms",
        status: "failed",
        errorMessage: "The dictionary provider could not be reached",
      },
      {
        jobId: "item-1:phonetic:job",
        fieldKey: "phonetic",
        status: "failed",
        errorMessage: "The dictionary provider could not be reached",
      },
      {
        jobId: "item-1:meaning:job",
        fieldKey: "meaning",
        status: "failed",
        errorMessage: "The dictionary provider could not be reached",
      },
    ]);
  });

  it("leaves jobs pending when Youdao permission is not configured", async () => {
    const lookup = vi.fn<DictionaryAdapter["lookup"]>()
      .mockRejectedValue(new DictionaryLookupError("permission-denied"));
    const source = createDictionaryEnrichmentSource({
      settings: { getActive: vi.fn().mockResolvedValue({ settings: activeSettings }) },
      dictionaryClient: createDictionaryClient(createFakeAdapter(lookup)),
    });

    await expect(source.executeBatch(request)).resolves.toEqual([]);
  });
});
