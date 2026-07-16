# ADR 0031: Bound Phase 02 Prompt Context Extraction

## Status

Accepted

## Context

The prompt-context data shape is frozen, but Phase 02 needs deterministic rules for extracting sentence, nearby paragraphs, and bounded page content. Without a fixed local strategy, content tests and privacy bounds would depend on browser heuristics that are not part of the contract.

## Decision

For the Phase 02 static-page vertical slice:

- Split English sentences with `Intl.Segmenter("en", { granularity: "sentence" })`; return an empty string when the selected sentence cannot be located.
- Define nearby paragraphs as the selected `p`, `li`, or `blockquote` plus the immediately preceding and following eligible block in document order.
- Build `webContent` from the current top-level document's `main` or `article`, falling back to `body`.
- Exclude navigation, footer, aside, hidden, extension-owned, interactive, editable, script, style, template, and code regions.
- Normalize whitespace and, when content exceeds 2000 UTF-16 code units, take a window centered around the selected block as far as document bounds allow.
- Do not traverse iframes or Shadow DOM and do not react to SPA navigation or later DOM changes in this slice.

## Consequences

Phase 02 has stable extraction and privacy bounds suitable for deterministic tests. Abbreviation handling follows the platform segmenter and may vary only with the target browser runtime. Iframe, Shadow DOM, SPA navigation, dynamic content, and more sophisticated article extraction remain explicit hardening work rather than hidden behavior in the first slice.
