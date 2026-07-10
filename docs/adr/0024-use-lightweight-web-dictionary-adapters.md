# Use lightweight Web dictionary adapters

Salto MVP will support `youdao-web` and `cambridge-web` as the initial dictionary providers because the current product priority is a free, lightweight browser-extension experience without bundling a large offline dictionary. Both providers must live behind a `DictionaryClient` adapter boundary. Core vocabulary and enrichment models must not depend on Youdao-specific endpoints, Cambridge-specific HTML, request signatures, cookies, anti-abuse behavior, field names, or failure modes.

This keeps the MVP practical while preserving a path to replace the Web adapters with official dictionary APIs, local MDX/ECDICT-style sources, or a Salto-owned remote dictionary service later.
