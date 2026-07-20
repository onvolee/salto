import type { PromptContext } from "./query-template/types";

export const PROMPT_CONTEXT_LIMITS = {
  selection: 500,
  sentence: 1000,
  paragraphs: 2000,
  webTitle: 300,
  webUrl: 2048,
  webContent: 2000,
} as const satisfies Readonly<Record<Exclude<keyof PromptContext, "targetLanguage">, number>>;

export function normalizePromptContext(context: PromptContext): PromptContext {
  return {
    selection: context.selection.slice(0, PROMPT_CONTEXT_LIMITS.selection),
    sentence: context.sentence.slice(0, PROMPT_CONTEXT_LIMITS.sentence),
    paragraphs: context.paragraphs.slice(0, PROMPT_CONTEXT_LIMITS.paragraphs),
    targetLanguage: context.targetLanguage,
    webTitle: context.webTitle.slice(0, PROMPT_CONTEXT_LIMITS.webTitle),
    webUrl: context.webUrl.slice(0, PROMPT_CONTEXT_LIMITS.webUrl),
    webContent: context.webContent.slice(0, PROMPT_CONTEXT_LIMITS.webContent),
  };
}

export function isPromptContextWithinLimits(context: PromptContext): boolean {
  return (Object.entries(PROMPT_CONTEXT_LIMITS) as Array<
    [keyof typeof PROMPT_CONTEXT_LIMITS, number]
  >).every(([key, limit]) => context[key].length <= limit);
}
