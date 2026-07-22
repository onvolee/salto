import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

type Rgb = readonly [number, number, number];

const themeCss = readFileSync(new URL("./linear-theme.css", import.meta.url), "utf8");
const rootTokens = tokenBlock(/:where\(:root, \.salto-theme-scope\) \{([\s\S]*?)\n\}/);
const darkTokens = tokenBlock(/\[data-theme="dark"\] \{([\s\S]*?)\n\}/);

function tokenBlock(pattern: RegExp): ReadonlyMap<string, string> {
  const body = themeCss.match(pattern)?.[1];
  if (!body) throw new Error(`Theme token block not found: ${pattern}`);
  return new Map([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [
    match[1],
    match[2].trim(),
  ]));
}

function themeToken(name: string, theme: "light" | "dark"): string {
  const tokens = theme === "dark" ? darkTokens : rootTokens;
  const value = tokens.get(name) ?? rootTokens.get(name);
  if (!value) throw new Error(`Theme token not found: ${name}`);
  const reference = value.match(/^var\((--[\w-]+)\)$/)?.[1];
  return reference ? themeToken(reference, theme) : value;
}

function color(value: string): Rgb {
  if (value === "white") return [1, 1, 1];
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255) as unknown as Rgb;
  }
  const match = value.match(/^lch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)/);
  if (!match) throw new Error(`Unsupported audit color: ${value}`);
  return labToSrgb(Number(match[1]), Number(match[2]), Number(match[3]));
}

function labToSrgb(lightness: number, chroma: number, hue: number): Rgb {
  const radians = hue * Math.PI / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const fy = (lightness + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inverse = (value: number) => value ** 3 > 216 / 24389
    ? value ** 3
    : (116 * value - 16) / (24389 / 27);
  const [x50, y50, z50] = [0.96422 * inverse(fx), inverse(fy), 0.82521 * inverse(fz)];
  const x = 0.9555766 * x50 - 0.0230393 * y50 + 0.0631636 * z50;
  const y = -0.0282895 * x50 + 1.0099416 * y50 + 0.0210077 * z50;
  const z = 0.0122982 * x50 - 0.020483 * y50 + 1.3299098 * z50;
  const linear = [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ];
  return linear.map((channel) => {
    const encoded = channel <= 0.0031308
      ? 12.92 * channel
      : 1.055 * channel ** (1 / 2.4) - 0.055;
    return Math.min(1, Math.max(0, encoded));
  }) as unknown as Rgb;
}

function luminance(rgb: Rgb): number {
  return rgb.reduce((sum, channel, index) => {
    const linear = channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}

function contrast(foreground: string, background: string): number {
  const values = [luminance(color(foreground)), luminance(color(background))];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

describe("theme accessibility contract", () => {
  it.each(["light", "dark"] as const)("keeps %s text tokens at WCAG AA contrast", (theme) => {
    const surface = themeToken("--salto-surface", theme);
    const cases = [
      ["foreground", themeToken("--salto-foreground", theme), 4.5],
      ["secondary", themeToken("--salto-muted-foreground", theme), 4.5],
      ["primary action", themeToken("--salto-primary-foreground", theme), 4.5, themeToken("--salto-primary", theme)],
      ["destructive", themeToken("--salto-destructive", theme), 4.5],
      ["success", themeToken("--salto-success", theme), 4.5],
      ["focus ring", themeToken("--salto-ring", theme), 3],
    ] as const;

    for (const [label, foreground, minimum, background = surface] of cases) {
      expect.soft(contrast(foreground, background), `${theme} ${label}`)
        .toBeGreaterThanOrEqual(minimum);
    }
  });

  it("uses the audited dark token overrides for system dark mode", () => {
    const systemDark = themeCss.match(/@media \(prefers-color-scheme: dark\) \{([\s\S]*)\n\}/)?.[1];
    expect(systemDark).toContain('--linear-color-text-tertiary: lch(61.399% 1.15 272 / 1)');
    expect(systemDark).toContain('--linear-focus-ring-color: #5e69d1');
  });
});
