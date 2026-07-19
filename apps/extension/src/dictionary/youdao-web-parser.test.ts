import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseYoudaoHtml } from "./youdao-web-parser";

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/youdao-web/${name}.html`, import.meta.url), "utf8");
}

describe("Youdao Web DOM parser", () => {
  it("extracts every normalized field from a common word", () => {
    expect(parseYoudaoHtml(fixture("common-word"))).toEqual({
      status: "found",
      fields: {
        phonetic: "/baenk/",
        partOfSpeech: "noun",
        meaning: "the land beside a river",
        synonyms: ["shore", "riverside"],
        wordForms: ["banks", "banked", "banking"]
      }
    });
  });

  it("preserves multiple parts of speech and pronunciations", () => {
    expect(parseYoudaoHtml(fixture("multi-part-of-speech"))).toEqual({
      status: "found",
      fields: {
        phonetic: "/rekord/; /rikord/",
        partOfSpeech: "noun, verb",
        meaning: "stored information\nto store information",
        synonyms: ["document", "register"],
        wordForms: ["records", "recorded", "recording"]
      }
    });
  });

  it("omits absent optional fields without losing successful fields", () => {
    expect(parseYoudaoHtml(fixture("missing-fields"))).toEqual({
      status: "found",
      fields: {
        partOfSpeech: "noun",
        meaning: "a financial institution"
      }
    });
  });

  it("distinguishes an explicit not-found page from changed markup", () => {
    expect(parseYoudaoHtml(fixture("not-found"))).toEqual({
      status: "not-found"
    });
    expect(() => parseYoudaoHtml(fixture("markup-changed"))).toThrow(
      expect.objectContaining({ code: "parser-failure" })
    );
  });
});
