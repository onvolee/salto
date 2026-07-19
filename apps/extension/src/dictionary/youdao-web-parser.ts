import {
  DictionaryLookupError,
  type DictionaryFixtureFields
} from "@salto/core";
import { parseHTML } from "linkedom/worker";

export type YoudaoParseResult =
  | { readonly status: "found"; readonly fields: DictionaryFixtureFields }
  | { readonly status: "not-found" };

const PART_OF_SPEECH_NAMES: Readonly<Record<string, string>> = {
  n: "noun",
  v: "verb",
  vt: "transitive verb",
  vi: "intransitive verb",
  adj: "adjective",
  adv: "adverb",
  prep: "preposition",
  conj: "conjunction",
  pron: "pronoun",
  num: "numeral",
  art: "article",
  int: "interjection",
  aux: "auxiliary verb"
};

const WORD_FORM_LABELS = [
  "复数",
  "第三人称单数",
  "现在分词",
  "过去式",
  "过去分词",
  "比较级",
  "最高级"
] as const;

function parserFailure(): never {
  throw new DictionaryLookupError("parser-failure");
}

function normalizedText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function parseDefinitions(container: Element): {
  readonly partOfSpeech?: string;
  readonly meaning?: string;
} {
  const partsOfSpeech: string[] = [];
  const meanings: string[] = [];

  for (const item of container.querySelectorAll("ul > li")) {
    const text = normalizedText(item.textContent);
    const match = /^([a-z]+\.)\s+(.+)$/i.exec(text);
    if (!match?.[1] || !match[2]) {
      return parserFailure();
    }
    const abbreviation = match[1].slice(0, -1).toLowerCase();
    partsOfSpeech.push(PART_OF_SPEECH_NAMES[abbreviation] ?? abbreviation);
    meanings.push(match[2]);
  }

  const normalizedParts = unique(partsOfSpeech);
  const normalizedMeanings = unique(meanings);
  return {
    ...(normalizedParts.length > 0 ? { partOfSpeech: normalizedParts.join(", ") } : {}),
    ...(normalizedMeanings.length > 0 ? { meaning: normalizedMeanings.join("\n") } : {})
  };
}

function parseWordForms(container: Element): readonly string[] {
  const text = normalizedText(container.querySelector(".additional")?.textContent);
  const forms: string[] = [];
  const pattern = new RegExp(`(?:${WORD_FORM_LABELS.join("|")})\\s+([^\\s\\]]+)`, "g");
  for (const match of text.matchAll(pattern)) {
    if (match[1]) forms.push(match[1]);
  }
  return unique(forms);
}

export function parseYoudaoHtml(html: string): YoudaoParseResult {
  const { document } = parseHTML(html);
  if (document.querySelector("#noResult")) {
    return { status: "not-found" };
  }

  const root = document.querySelector("#phrsListTab");
  const keyword = root?.querySelector(".keyword");
  const definitions = root?.querySelector(".trans-container");
  if (!root || !keyword || !normalizedText(keyword.textContent) || !definitions) {
    return parserFailure();
  }

  const phonetics = unique(
    [...root.querySelectorAll(".phonetic")]
      .map((element) => normalizedText(element.textContent))
  );
  const synonyms = unique(
    [...document.querySelectorAll("#synonyms .contentTitle a")]
      .map((element) => normalizedText(element.textContent))
  );
  const wordForms = parseWordForms(definitions);
  const definitionFields = parseDefinitions(definitions);

  return {
    status: "found",
    fields: {
      ...(phonetics.length > 0 ? { phonetic: phonetics.join("; ") } : {}),
      ...definitionFields,
      ...(synonyms.length > 0 ? { synonyms } : {}),
      ...(wordForms.length > 0 ? { wordForms } : {})
    }
  };
}
