import { describe, expect, it, vi } from "vitest";

import {
  createDictionaryClient,
  createFakeDictionaryAdapter,
  normalizeDictionaryFields
} from "./client";
import type { DictionaryAdapter } from "./types";
import { dictionaryAdapterContract } from "./adapter-contract";

dictionaryAdapterContract("deterministic fake", {
  providerId: "youdao-web",
  createAdapter(scenario) {
    return createFakeDictionaryAdapter({
      providerId: "youdao-web",
      supportedLanguages: ["en"],
      fixtures: [{
        request: { term: "bank", language: "en" },
        ...(scenario === "parser-failure"
          ? { failure: "parser-failure" as const }
          : {
              fields: scenario === "missing-fields"
                ? { meaning: "a financial institution" }
                : {
                    phonetic: "/baenk/",
                    partOfSpeech: "noun",
                    meaning: "the land beside a river",
                    synonyms: ["shore", "riverside"],
                    wordForms: ["banks", "banked", "banking"]
                  }
            })
      }]
    });
  }
});

describe("dictionary client contract", () => {
  it("returns every normalized dictionary field with its fixed value shape", async () => {
    const adapter = createFakeDictionaryAdapter({
      providerId: "youdao-web",
      supportedLanguages: ["en"],
      fixtures: [{
        request: { term: "bank", language: "en" },
        fields: {
          phonetic: "/baenk/",
          partOfSpeech: "noun",
          meaning: "the land beside a river",
          synonyms: ["shore", "riverside"],
          wordForms: ["banks", "banked", "banking"]
        }
      }]
    });
    const client = createDictionaryClient(adapter);

    await expect(client.lookup(
      { term: "bank", language: "en" },
      new AbortController().signal
    )).resolves.toEqual({
      providerId: "youdao-web",
      term: "bank",
      language: "en",
      fields: {
        phonetic: { status: "ready", type: "text", value: "/baenk/" },
        partOfSpeech: { status: "ready", type: "text", value: "noun" },
        meaning: { status: "ready", type: "text", value: "the land beside a river" },
        synonyms: { status: "ready", type: "list", value: ["shore", "riverside"] },
        wordForms: { status: "ready", type: "list", value: ["banks", "banked", "banking"] }
      }
    });
  });

  it("rejects unsupported languages before starting the adapter lookup", async () => {
    const lookup = vi.fn<DictionaryAdapter["lookup"]>();
    const client = createDictionaryClient({
      capabilities: {
        providerId: "youdao-web",
        supportedLanguages: ["en"],
        supportedFields: ["phonetic", "partOfSpeech", "meaning", "synonyms", "wordForms"]
      },
      lookup
    });

    await expect(client.lookup(
      { term: "banque", language: "fr" },
      new AbortController().signal
    )).rejects.toEqual(expect.objectContaining({
      code: "unsupported-language",
      message: "The dictionary provider does not support this language"
    }));
    expect(lookup).not.toHaveBeenCalled();
  });

  it("rejects an incorrect normalized value shape without exposing provider content", () => {
    expect(() => normalizeDictionaryFields({
      meaning: ["secret-provider-body"]
    }, ["meaning"])).toThrow(expect.objectContaining({
      code: "parser-failure",
      message: "The dictionary response could not be parsed"
    }));
  });

  it("distinguishes an absent entry from fields missing on a found entry", () => {
    const supported = [
      "phonetic",
      "partOfSpeech",
      "meaning",
      "synonyms",
      "wordForms"
    ] as const;

    expect(normalizeDictionaryFields({}, supported).meaning).toEqual({
      status: "unavailable",
      type: "text",
      reason: "missing"
    });
    expect(normalizeDictionaryFields({}, supported, {
      missingReason: "not-found"
    }).meaning).toEqual({
      status: "unavailable",
      type: "text",
      reason: "not-found"
    });
  });

  it("distinguishes missing fields from unsupported adapter capabilities", async () => {
    const adapter = createFakeDictionaryAdapter({
      providerId: "youdao-web",
      supportedLanguages: ["en"],
      supportedFields: ["phonetic", "partOfSpeech", "meaning", "synonyms"],
      fixtures: [{
        request: { term: "bank", language: "en" },
        fields: { meaning: "a financial institution" }
      }]
    });

    const result = await createDictionaryClient(adapter).lookup(
      { term: "bank", language: "en" },
      new AbortController().signal
    );

    expect(result.fields.phonetic).toEqual({
      status: "unavailable",
      type: "text",
      reason: "missing"
    });
    expect(result.fields.wordForms).toEqual({
      status: "unavailable",
      type: "list",
      reason: "unsupported"
    });
    expect(adapter.capabilities).toEqual({
      providerId: "youdao-web",
      supportedLanguages: ["en"],
      supportedFields: ["phonetic", "partOfSpeech", "meaning", "synonyms"]
    });
  });

  it("rejects a pre-cancelled lookup before starting the adapter", async () => {
    const lookup = vi.fn<DictionaryAdapter["lookup"]>();
    const controller = new AbortController();
    controller.abort();
    const client = createDictionaryClient({
      capabilities: {
        providerId: "youdao-web",
        supportedLanguages: ["en"],
        supportedFields: ["meaning"]
      },
      lookup
    });

    await expect(client.lookup(
      { term: "bank", language: "en" },
      controller.signal
    )).rejects.toEqual(expect.objectContaining({
      code: "cancelled",
      message: "The dictionary lookup was cancelled"
    }));
    expect(lookup).not.toHaveBeenCalled();
  });

  it("maps adapter parser exceptions to a stable failure without provider content", async () => {
    const client = createDictionaryClient({
      capabilities: {
        providerId: "youdao-web",
        supportedLanguages: ["en"],
        supportedFields: ["meaning"]
      },
      async lookup() {
        throw new Error("selector failed near provider-secret-html");
      }
    });

    await expect(client.lookup(
      { term: "bank", language: "en" },
      new AbortController().signal
    )).rejects.toEqual(expect.objectContaining({
      code: "parser-failure",
      message: "The dictionary response could not be parsed"
    }));
  });
});
