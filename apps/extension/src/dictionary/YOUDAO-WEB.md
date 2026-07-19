# Youdao Web adapter

The adapter is restricted to `https://dict.youdao.com/*` and constructs lookups as
`/w/eng/{encoded term}/`. Callers cannot supply an origin, path, or proxy URL. Requests
omit credentials and require browser-reported permission coverage for the exact origin.
The Sources gesture requests that optional origin explicitly. The existing `<all_urls>`
content script may already satisfy Chrome's coverage check; Ticket 20 audits whether the
global injection model should be narrowed. The manifest does not declare a required
dictionary host permission.

## Parser boundary

The parser uses these provider-owned DOM anchors observed on 2026-07-19:

- `#phrsListTab` and `.keyword` identify a dictionary entry.
- `.phonetic` supplies pronunciation text.
- `.trans-container ul > li` supplies part-of-speech and meaning pairs.
- `.additional` supplies known word-form label/value pairs.
- `#synonyms .contentTitle a` supplies synonyms.
- `#noResult` identifies an explicit missing entry.

If the entry anchors change, the parser returns `parser-failure`. Optional sections may be
absent without discarding successful fields. The adapter does not parse examples,
etymology, phrases, account state, advertisements, or scripts. Errors expose only stable
contract codes; response HTML and selector diagnostics are never logged.

## Verification

Default tests use sanitized local fixtures and make no network requests. The opt-in smoke
test is limited to `example`:

```sh
SALTO_YOUDAO_LIVE_SMOKE=1 pnpm --filter @salto/extension exec vitest run src/dictionary/youdao-web-live.test.ts
```

The provider is an unofficial Web integration and can change without notice. A selector
change should be handled by updating dated fixtures and parser tests before changing the
normalized contract.
