import { describe, expect, it } from "vitest";

import {
  findSavedTermMatches,
  normalizeSavedTerms
} from "./saved-term-matcher";

describe("saved-term matcher", () => {
  it("normalizes terms with the vocabulary algorithm and deduplicates canonical keys", () => {
    expect(normalizeSavedTerms([
      "  Running\n shoes  ",
      "running shoes",
      "\uFF26\uFF4F\uFF4F",
      "",
      "   "
    ])).toEqual([
      { canonicalKey: "en:foo", term: "Foo" },
      { canonicalKey: "en:running shoes", term: "Running shoes" }
    ]);
  });

  it("does not mutate the caller's term collection", () => {
    const terms = Object.freeze(["  Running  ", "running", "cat"]);

    findSavedTermMatches("Running cat", terms);

    expect(terms).toEqual(["  Running  ", "running", "cat"]);
  });

  it("finds case-insensitive whole English terms with source-text offsets", () => {
    expect(findSavedTermMatches("A RUNNING runner is running.", ["running"])).toEqual([
      { canonicalKey: "en:running", start: 2, end: 9 },
      { canonicalKey: "en:running", start: 20, end: 27 }
    ]);
  });

  it("uses ASCII letter, digit, and underscore boundaries, while apostrophes and Unicode are non-boundaries", () => {
    expect(findSavedTermMatches("cat catalog cat2 cat_ cat's fooé", ["cat", "foo"])).toEqual([
      { canonicalKey: "en:cat", start: 0, end: 3 },
      { canonicalKey: "en:cat", start: 22, end: 25 },
      { canonicalKey: "en:foo", start: 28, end: 31 }
    ]);
  });

  it("matches apostrophes literally and does not apply Unicode case folding", () => {
    expect(findSavedTermMatches("DON'T don't CAFÉ café", ["don't", "café"])).toEqual([
      { canonicalKey: "en:don't", start: 0, end: 5 },
      { canonicalKey: "en:don't", start: 6, end: 11 },
      { canonicalKey: "en:café", start: 17, end: 21 }
    ]);
  });

  it("keeps the longest overlap and resolves equal lengths by canonical key regardless of input order", () => {
    expect(findSavedTermMatches("new york a-b-c", ["york", "new", "new york", "b-c", "a-b"])).toEqual([
      { canonicalKey: "en:new york", start: 0, end: 8 },
      { canonicalKey: "en:a-b", start: 9, end: 12 }
    ]);
    expect(findSavedTermMatches("new york a-b-c", ["a-b", "b-c", "new york", "new", "york"])).toEqual([
      { canonicalKey: "en:new york", start: 0, end: 8 },
      { canonicalKey: "en:a-b", start: 9, end: 12 }
    ]);
  });

  it("matches regular-expression metacharacters as literal saved terms", () => {
    expect(findSavedTermMatches("C++ Cpp [test] a.b (group)? dollar$", [
      "C++",
      "[test]",
      "a.b",
      "(group)?",
      "dollar$"
    ])).toEqual([
      { canonicalKey: "en:c++", start: 0, end: 3 },
      { canonicalKey: "en:[test]", start: 8, end: 14 },
      { canonicalKey: "en:a.b", start: 15, end: 18 },
      { canonicalKey: "en:(group)?", start: 19, end: 27 },
      { canonicalKey: "en:dollar$", start: 28, end: 35 }
    ]);
  });

  it("remains deterministic for a large term set regardless of input order", () => {
    const terms = Array.from({ length: 2_000 }, (_, index) => `term${index}`);
    const text = "term1999 and term42";
    const expected = [
      { canonicalKey: "en:term1999", start: 0, end: 8 },
      { canonicalKey: "en:term42", start: 13, end: 19 }
    ];

    expect(findSavedTermMatches(text, terms)).toEqual(expected);
    expect(findSavedTermMatches(text, [...terms].reverse())).toEqual(expected);
  });
});
