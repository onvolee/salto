import { describe, expect, it } from "vitest";

import {
  PROMPT_CONTEXT_LIMITS,
  isPromptContextWithinLimits,
  normalizePromptContext,
} from "./context-boundaries";

describe("prompt context boundaries", () => {
  it("bounds every page-derived field using one UTF-16 limit contract", () => {
    const context = normalizePromptContext({
      selection: "s".repeat(501),
      sentence: "e".repeat(1001),
      paragraphs: "p".repeat(2001),
      targetLanguage: "zh-CN",
      webTitle: "t".repeat(301),
      webUrl: "u".repeat(2049),
      webContent: "c".repeat(2001),
    });

    expect(PROMPT_CONTEXT_LIMITS).toEqual({
      selection: 500,
      sentence: 1000,
      paragraphs: 2000,
      webTitle: 300,
      webUrl: 2048,
      webContent: 2000,
    });
    expect(context).toMatchObject({ targetLanguage: "zh-CN" });
    expect(context.selection.length).toBe(500);
    expect(context.sentence.length).toBe(1000);
    expect(context.paragraphs.length).toBe(2000);
    expect(context.webTitle.length).toBe(300);
    expect(context.webUrl.length).toBe(2048);
    expect(context.webContent.length).toBe(2000);
    expect(isPromptContextWithinLimits(context)).toBe(true);
    expect(isPromptContextWithinLimits({ ...context, sentence: `${context.sentence}x` })).toBe(false);
  });
});
