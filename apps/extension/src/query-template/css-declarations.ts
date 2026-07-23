import type { CSSProperties } from "react";

function reactPropertyName(property: string): string {
  if (property.startsWith("--")) return property;
  return property.replace(/^-ms-/, "ms-").replace(/-([a-z])/g, (_, letter: string) =>
    letter.toUpperCase());
}

export function parseCssDeclarations(declarations: string): CSSProperties {
  if (typeof document === "undefined" || !declarations.trim()) return {};
  const style = document.createElement("span").style;
  style.cssText = declarations;
  const parsed: Record<string, string> = {};
  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index);
    if (!property) continue;
    parsed[reactPropertyName(property)] = style.getPropertyValue(property).trim();
  }
  return parsed as CSSProperties;
}
