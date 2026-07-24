import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const optionsCss = readFileSync(
  new URL("../../entrypoints/setting.options/style.css", import.meta.url),
  "utf8",
);

describe("shadcn theme contract", () => {
  it("keeps shadcn semantic utilities on shadcn tokens", () => {
    const semanticTokens = [
      "background",
      "foreground",
      "card",
      "popover",
      "primary",
      "secondary",
      "muted",
      "accent",
      "destructive",
      "border",
      "input",
      "ring",
      "sidebar",
    ];

    for (const token of semanticTokens) {
      expect(optionsCss).toContain(`--color-${token}: var(--${token});`);
      expect(optionsCss).not.toContain(`--color-${token}: var(--salto-`);
    }
  });

  it("exposes Salto colors through an opt-in namespace", () => {
    expect(optionsCss).toContain(
      "--color-salto-background: var(--salto-background);",
    );
    expect(optionsCss).toContain("--color-salto-border: var(--salto-border);");
    expect(optionsCss).toContain("--color-salto-primary: var(--salto-primary);");
    expect(optionsCss).toContain("--color-salto-success: var(--salto-success);");
    expect(optionsCss).not.toContain("--color-success: var(--salto-success);");
  });

  it("keeps shadcn dark input and border treatments distinct", () => {
    expect(optionsCss).toContain("--border: oklch(1 0 0 / 10%);");
    expect(optionsCss).toContain("--input: oklch(1 0 0 / 15%);");
  });
});
