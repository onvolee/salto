import {
  DictionaryLookupError,
  type DictionaryFixtureFields,
  type YoudaoPreview,
  type YoudaoPreviewSection,
  type YoudaoTextPreviewSection,
} from "@salto/core";
import { parseHTML } from "linkedom/worker";

export type YoudaoParseResult =
  | { readonly status: "found"; readonly fields: DictionaryFixtureFields }
  | { readonly status: "not-found" };

export type YoudaoPreviewParseResult =
  | { readonly status: "found"; readonly preview: YoudaoPreview }
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

function textEntries(root: ParentNode, selector: string): readonly string[] {
  return [...root.querySelectorAll(selector)]
    .map((element) => normalizedText(element.textContent))
    .filter(Boolean);
}

function textSection(
  kind: YoudaoTextPreviewSection["kind"],
  entries: readonly string[],
): YoudaoPreview["sections"][number] | null {
  return entries.length > 0 ? { kind, entries } : null;
}

function wordFormSection(container: Element): YoudaoPreviewSection | null {
  const text = normalizedText(container.querySelector(".additional")?.textContent);
  const entries = [...text.matchAll(new RegExp(`(${WORD_FORM_LABELS.join("|")})\\s+([^\\s\\]]+)`, "g"))]
    .flatMap((match) => match[1] && match[2] ? [{ label: match[1], value: match[2] }] : []);
  return entries.length > 0 ? { kind: "word-forms", entries } : null;
}

function phraseSection(document: Document): YoudaoPreviewSection | null {
  const entries = [...document.querySelectorAll("#webPhrase p.wordGroup, #wordGroup2 p.wordGroup")]
    .flatMap((element) => {
      const phrase = normalizedText(element.querySelector(".contentTitle a")?.textContent);
      const meaning = normalizedText(element.textContent).replace(phrase, "").trim();
      return phrase ? [{ phrase, ...(meaning ? { meaning } : {}) }] : [];
    });
  return entries.length > 0 ? { kind: "phrases", entries } : null;
}

function exampleSection(document: Document): YoudaoPreviewSection | null {
  const entries = [...document.querySelectorAll("#examples #bilingual li, #blng_sents_part li")]
    .flatMap((element) => {
      const paragraphs = [...element.querySelectorAll("p")].map((paragraph) => normalizedText(paragraph.textContent));
      const english = paragraphs[0];
      if (!english) return [];
      const chinese = paragraphs[1];
      const source = normalizedText(element.querySelector(".example-via")?.textContent);
      return [{ english, ...(chinese ? { chinese } : {}), ...(source ? { source } : {}) }];
    });
  return entries.length > 0 ? { kind: "examples", entries } : null;
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

export function parseYoudaoPreviewHtml(html: string): YoudaoPreviewParseResult {
  const { document } = parseHTML(html);
  if (document.querySelector("#noResult")) {
    return { status: "not-found" };
  }

  const root = document.querySelector("#phrsListTab");
  const keyword = root?.querySelector(".keyword");
  const definitions = root?.querySelector(".trans-container");
  const term = normalizedText(keyword?.textContent);
  if (!root || !term || !definitions) {
    return parserFailure();
  }

  const sections = [
    textSection("basic", [
      ...textEntries(root, ".phonetic"),
      ...textEntries(definitions, "ul > li"),
    ]),
    wordFormSection(definitions),
    textSection("web-or-specialized", textEntries(document, "#tWebTrans, #webTrans, #special, #specialEng")),
    textSection("english-or-bilingual", textEntries(document, "#ee, #eng, #english")),
    phraseSection(document),
    textSection("synonyms", textEntries(document, "#synonyms .contentTitle a")),
    exampleSection(document),
  ].filter((candidate): candidate is YoudaoPreview["sections"][number] => candidate !== null);

  return { status: "found", preview: { term, sections } };
}
