import { describe, expect, it } from "vitest";

import { createDictionaryClient } from "./client";
import type { DictionaryAdapter, DictionaryProviderId } from "./types";

export type DictionaryAdapterContractScenario =
  | "complete"
  | "missing-fields"
  | "parser-failure";

export interface DictionaryAdapterContractHarness {
  readonly providerId: DictionaryProviderId;
  createAdapter(scenario: DictionaryAdapterContractScenario): DictionaryAdapter;
}

export function dictionaryAdapterContract(
  name: string,
  harness: DictionaryAdapterContractHarness
): void {
  describe(`${name} dictionary adapter contract`, () => {
    it("returns the normalized text and list fields", async () => {
      const client = createDictionaryClient(harness.createAdapter("complete"));

      await expect(client.lookup(
        { term: "bank", language: "en" },
        new AbortController().signal
      )).resolves.toEqual({
        providerId: harness.providerId,
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

    it("marks supported fields absent from the provider response as missing", async () => {
      const client = createDictionaryClient(harness.createAdapter("missing-fields"));
      const result = await client.lookup(
        { term: "bank", language: "en" },
        new AbortController().signal
      );

      expect(result.fields.meaning).toEqual({
        status: "ready",
        type: "text",
        value: "a financial institution"
      });
      expect(result.fields.phonetic).toEqual({
        status: "unavailable",
        type: "text",
        reason: "missing"
      });
      expect(result.fields.synonyms).toEqual({
        status: "unavailable",
        type: "list",
        reason: "missing"
      });
    });

    it("rejects unsupported languages before the adapter lookup starts", async () => {
      const client = createDictionaryClient(harness.createAdapter("complete"));

      await expect(client.lookup(
        { term: "banque", language: "fr" },
        new AbortController().signal
      )).rejects.toEqual(expect.objectContaining({ code: "unsupported-language" }));
    });

    it("honors a pre-cancelled lookup", async () => {
      const controller = new AbortController();
      controller.abort();
      const client = createDictionaryClient(harness.createAdapter("complete"));

      await expect(client.lookup(
        { term: "bank", language: "en" },
        controller.signal
      )).rejects.toEqual(expect.objectContaining({ code: "cancelled" }));
    });

    it("returns the shared parser failure category", async () => {
      const client = createDictionaryClient(harness.createAdapter("parser-failure"));

      await expect(client.lookup(
        { term: "bank", language: "en" },
        new AbortController().signal
      )).rejects.toEqual(expect.objectContaining({
        code: "parser-failure",
        message: "The dictionary response could not be parsed"
      }));
    });
  });
}
