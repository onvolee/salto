import type { TranslationField } from "./types";

export const INITIAL_TRANSLATION_FIELDS: TranslationField[] = [
  {
    id: "example",
    label: "例句",
    type: "例句",
    source: "AI 服务",
    description: "保留原文例句，并提供简体中文翻译。",
    enabled: true,
  },
  {
    id: "meaning",
    label: "释义",
    type: "文本",
    source: "AI 服务",
    description: "结合上下文返回简洁、明确的中文含义。",
    enabled: true,
  },
  {
    id: "part-of-speech",
    label: "词性",
    type: "文本",
    source: "剑桥词典",
    description: "展示名词、动词等基础词性信息。",
    enabled: true,
  },
];

export const TRANSLATION_PROVIDERS = [
  {
    id: "youdao",
    name: "有道词典",
    detail: "轻量 Web dictionary adapter",
  },
  {
    id: "cambridge",
    name: "剑桥词典",
    detail: "适合获取词性与英文释义",
  },
  {
    id: "ai-translation",
    name: "AI 翻译",
    detail: "需要配置 OpenAI-compatible API",
  },
] as const;
