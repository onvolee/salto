// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import { parseCssDeclarations } from "./css-declarations";

describe("parseCssDeclarations", () => {
  it("uses the browser declaration parser and drops invalid declarations", () => {
    expect(parseCssDeclarations(
      "color: rgb(12, 34, 56); definitely-not-css; font-weight: 700;",
    )).toEqual({
      color: "rgb(12, 34, 56)",
      fontWeight: "700",
    });
  });

  it("keeps custom properties and isolates each parse", () => {
    expect(parseCssDeclarations("--accent: teal; padding-inline: 4px"))
      .toEqual({ "--accent": "teal", paddingInline: "4px" });
    expect(parseCssDeclarations("not valid"))
      .toEqual({});
  });
});
