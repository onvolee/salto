import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseYoudaoHtml, parseYoudaoPreviewHtml } from "./youdao-web-parser";

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/youdao-web/${name}.html`, import.meta.url), "utf8");
}

describe("Youdao Web DOM parser", () => {
  it("exposes available provider sections as structured text without preserving markup", () => {
    expect(parseYoudaoPreviewHtml(fixture("common-word"))).toEqual({
      status: "found",
      preview: {
        term: "bank",
        sections: [
          { kind: "basic", entries: ["/baenk/", "n. the land beside a river"] },
          { kind: "word-forms", entries: [
            { label: "复数", value: "banks" },
            { label: "过去式", value: "banked" },
            { label: "现在分词", value: "banking" },
          ] },
          { kind: "synonyms", entries: ["shore", "riverside"] },
        ],
      },
    });
  });

  it("keeps each available source-native preview category separate", () => {
    const html = `
      <div id="phrsListTab">
        <span class="keyword">example</span>
        <span class="phonetic">/igzaempl/</span>
        <div class="trans-container"><ul><li>n. a representative instance</li></ul><p class="additional">[ 复数 examples ]</p></div>
      </div>
      <div id="tWebTrans">网络释义内容</div>
      <div id="ee">English definition</div>
      <div id="wordGroup">短语内容</div>
      <div id="synonyms"><span class="contentTitle"><a>instance</a></span></div>
      <div id="examples">This is an example.</div>
    `;

    expect(parseYoudaoPreviewHtml(html)).toEqual({
      status: "found",
      preview: {
        term: "example",
        sections: [
          { kind: "basic", entries: ["/igzaempl/", "n. a representative instance"] },
          { kind: "word-forms", entries: [{ label: "复数", value: "examples" }] },
          { kind: "web-or-specialized", entries: ["网络释义内容"] },
          { kind: "english-or-bilingual", entries: ["English definition"] },
          { kind: "synonyms", entries: ["instance"] },
        ],
      },
    });
  });

  it("keeps word forms, phrases, and examples as independent structured records", () => {
    const html = `
      <div id="phrsListTab">
        <span class="keyword">example</span>
        <div class="trans-container">
          <ul><li>n. a representative instance</li></ul>
          <p class="additional">[ 复数 examples 过去式 exemplified ]</p>
        </div>
      </div>
      <div id="webPhrase">
        <p class="wordGroup"><span class="contentTitle"><a>for example</a></span> as an instance</p>
        <p class="wordGroup"><span class="contentTitle"><a>set an example</a></span> provide a model</p>
      </div>
      <div id="examples"><div id="bilingual"><ul>
        <li><p>An example helps.</p><p>一个例子会有帮助。</p><span class="example-via">Source A</span></li>
        <li><p>Use another example.</p><p>再用一个例子。</p><span class="example-via">Source B</span></li>
      </ul></div></div>
    `;

    expect(parseYoudaoPreviewHtml(html)).toMatchObject({
      status: "found",
      preview: {
        sections: expect.arrayContaining([
          {
            kind: "word-forms",
            entries: [
              { label: "复数", value: "examples" },
              { label: "过去式", value: "exemplified" },
            ],
          },
          {
            kind: "phrases",
            entries: [
              { phrase: "for example", meaning: "as an instance" },
              { phrase: "set an example", meaning: "provide a model" },
            ],
          },
          {
            kind: "examples",
            entries: [
              { english: "An example helps.", chinese: "一个例子会有帮助。", source: "Source A" },
              { english: "Use another example.", chinese: "再用一个例子。", source: "Source B" },
            ],
          },
        ]),
      },
    });
  });

  it("preserves repeated source text as independent preview entries", () => {
    const html = `
      <div id="phrsListTab"><span class="keyword">example</span><div class="trans-container"><ul><li>n. example</li></ul></div></div>
      <div id="examples"><div id="bilingual"><ul>
        <li><p>Repeated example.</p></li><li><p>Repeated example.</p></li>
      </ul></div></div>
    `;

    const parsed = parseYoudaoPreviewHtml(html);
    expect(parsed.status).toBe("found");
    if (parsed.status === "found") {
      expect(parsed.preview.sections.find(({ kind }) => kind === "examples")).toEqual({
        kind: "examples",
        entries: [{ english: "Repeated example." }, { english: "Repeated example." }],
      });
    }
  });
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
