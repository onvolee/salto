# Browser Selection Translation MVP

Status: ready-for-agent

## Problem Statement

When reading English content on the web, Chinese-speaking users frequently encounter unfamiliar words or short phrases. They currently have to leave the page, open a separate dictionary or translation app, and lose their reading context. Existing browser extensions either provide only simple dictionary lookups without configurable output, or require the user to manage multiple tools for translation, vocabulary saving, and later review. There is no lightweight extension that combines configurable reading-time translation, immediate vocabulary saving without waiting for remote requests, asynchronous enrichment of fixed vocabulary fields, and saved-vocabulary highlighting — all while keeping data local and sync-ready for future mobile clients.

## Solution

Salto is a Chrome/Chromium browser extension that lets users select an English word or short phrase (up to 500 characters), intentionally open a nearby translation panel, read configurable LLM or dictionary output in schema order, and save useful vocabulary without leaving the page. Saving persists sync-ready vocabulary data immediately via a local IndexedDB transaction; extension-local background enrichment jobs then populate fixed vocabulary fields asynchronously and generate a meaning-recall learning card once both the term and meaning fields are ready. Saved terms are highlighted on pages with a wavy underline. The extension supports one active OpenAI-compatible LLM configuration and one active dictionary adapter, with query templates that users can create, edit, and reorder. All data is local-first with sync-ready vocabulary and learning records, while extension-local configuration (templates, LLM config, enrichment jobs, highlighting state) remains unsynced.

## User Stories

1. As a reader, I want to select an English word or short phrase on any web page, so that I can look up its meaning without leaving the page.
2. As a reader, I want a small floating trigger to appear near my selection, so that I can intentionally decide whether to translate.
3. As a reader, I want selection alone to send no remote request, so that my reading behavior does not leak data to external providers.
4. As a reader, I want to click the floating trigger or press a keyboard shortcut to open the translation panel, so that I control when provider requests are made.
5. As a reader, I want the translation panel to appear near my selection and flip at viewport edges, so that it is always visible and does not obscure the text I am reading.
6. As a reader, I want to see the active query template name in the panel, so that I know which template is producing the output.
7. As a reader, I want to switch between query templates from the panel, so that I can compare different translation configurations.
8. As a reader, I want translation fields to appear in schema order with independent loading, ready, unavailable, and failed states, so that I can understand the status of each field.
9. As a reader, I want to save the selected vocabulary without waiting for a provider request, so that saving is instant and does not depend on network availability.
10. As a reader, I want re-saving the same word to append a deduplicated reading context rather than creating a duplicate vocabulary item, so that my vocabulary list stays clean.
11. As a reader, I want vocabulary fields to be enriched asynchronously in the background, so that I can continue reading while enrichment happens.
12. As a reader, I want failed enrichment fields to retry independently, so that one field's failure does not block others.
13. As a reader, I want a meaning-recall learning card to be generated after both term and meaning fields are ready, so that I can later review the word.
14. As a reader, I want saved vocabulary terms to be highlighted on pages with a wavy underline, so that I can recognize words I have already saved.
15. As a reader, I want highlighting to work on initial and dynamically added page content, so that saved terms are always visible.
16. As a reader, I want to disable highlighting and have the original text restored, so that I can control the visual treatment.
17. As a reader, I want to close the translation panel with outside click or Esc, so that I can dismiss it quickly.
18. As a reader, I want the panel to remain reachable on narrow viewports, so that it works on different screen sizes.
19. As a reader, I want stale results to be ignored after close or regeneration, so that I never see outdated output.
20. As a reader, I want to refresh or regenerate translation output, so that I can retry failed fields or get new results.
21. As a power user, I want to create, copy, and delete query templates, so that I can manage multiple translation configurations.
22. As a power user, I want to edit template field labels, sources, LLM types, instructions, and dictionary fields, so that I can customize translation output.
23. As a power user, I want to enable, disable, and reorder template fields, so that I control which fields appear and in what order.
24. As a power user, I want to choose one default template, so that my preferred configuration is used automatically.
25. As a power user, I want at least one immutable system template to always be available, so that I always have a working baseline.
26. As a power user, I want to configure one OpenAI-compatible LLM provider with a base URL, model, and optional temperature, so that I can use my preferred LLM service.
27. As a power user, I want to enter my API key in the options page and have it stored separately from the public configuration, so that my key is not exposed in the UI.
28. As a power user, I want the extension to request host permission only for the configured LLM origin when I explicitly save or test the configuration, so that the extension does not have unnecessary remote access.
29. As a power user, I want permission denial to be a visible, recoverable state, so that I can retry or change the origin.
30. As a power user, I want the extension to remove an obsolete origin permission grant after replacement, so that unused permissions are cleaned up.
31. As a power user, I want to choose the active dictionary adapter, so that I can select my preferred dictionary provider.
32. As a power user, I want to set my target translation language, so that LLM output is in my preferred language.
33. As a power user, I want to choose between system, light, and dark theme modes, so that the extension matches my appearance preference.
34. As a reader, I want the extension to work in Chrome and Chromium, so that it is compatible with my browser.
35. As a reader, I want my vocabulary data to survive a service worker restart, so that I do not lose saved words.
36. As a reader, I want API keys to never appear in logs, errors, content scripts, or packaged artifacts, so that my secrets are protected.
37. As a reader, I want page content sent to LLM providers to be bounded and transient, so that my reading data is not stored unnecessarily.
38. As a reader, I want the fixed vocabulary schema to be system-owned and not editable, so that the data model remains consistent.
39. As a reader, I want translation panel results to never populate vocabulary fields, so that translation and enrichment remain separate workflows.
40. As a reader, I want the canonical key to use NFKC normalization, collapsed whitespace, and English lowercase without lemmatization, so that case variants map to the same vocabulary item while distinct words remain separate.
41. As a reader, I want vocabulary context deduplication to use vocabulary item ID, normalized page URL, and normalized sentence, so that identical reading contexts do not create duplicate records.
42. As a reader, I want each vocabulary field to track its own status and retry state independently, so that field-level failures are isolated.
43. As a reader, I want item-level display state to be derived from field states rather than persisted separately, so that there is one source of truth.
44. As a reader, I want the extension to seed default settings and the system query template idempotently on installation and recovery, so that the extension always has a working baseline.
45. As a reader, I want the background service worker to validate message payloads at the boundary, so that invalid requests are rejected with stable error responses.
46. As a reader, I want the background to permit LLM requests only to the configured and granted origin, so that the extension cannot be used as an arbitrary URL proxy.
47. As a reader, I want dictionary adapter behavior to remain behind a normalized boundary, so that provider-specific details do not leak into vocabulary contracts.
48. As a reader, I want default tests to make no live provider requests, so that the test suite is deterministic and fast.
49. As a reader, I want DOM scans for highlighting to remain bounded and incremental, so that page performance is not degraded.
50. As a reader, I want database schema changes to use forward migrations without clearing user data, so that upgrades are safe.

## Implementation Decisions

- **Stack**: WXT.js extension under `apps/extension`, React at UI entrypoint edges, TypeScript 7.x, IndexedDB through Dexie, Vitest for testing. Storage-neutral domain contracts live under `packages/core` and must not import WXT, React, Dexie, IndexedDB, or browser APIs.

- **Boundary ownership**: `entrypoints/background.ts` owns persistent writes, external requests, permission-checked adapter execution, enrichment scheduling, and API-key access. `entrypoints/content.ts` owns selection, page-context extraction, the panel host, highlighting, and typed messages. `entrypoints/options/` owns template and extension configuration through services/messages, not direct Dexie table access.

- **Selection translation and saved vocabulary are separate workflows**: Translation panel results are transient reading output and never populate vocabulary fields. Saving uses a separate path that creates or reuses a `VocabularyItem` by canonical key, stores fixed fields and a deduplicated `VocabularyContext`, creates enrichment jobs, and commits atomically.

- **Query template contract**: Query templates are extension-local configuration, not syncable vocabulary fields. Fields have `source: "llm" | "dictionary"`, `type: "text" | "list"`, and dictionary fields derive their type from `DictionaryQueryFieldSpec`. All enabled LLM fields merge into one LLM request per run; all enabled dictionary fields merge into one lookup per adapter and run. Results preserve schema order. Disabled fields are absent, not failed.

- **Query field result shape**: Per-field results are discriminated unions with `status: "ready" | "unavailable" | "failed"`. Ready results carry `type: "text"` with `value: string` or `type: "list"` with `value: readonly string[]`. Missing configuration or expected-but-absent values are `unavailable`; malformed or type-mismatched provider output is `failed`. Neither state discards successful siblings.

- **Prompt context contract**: LLM instructions support exactly `selection`, `sentence`, `paragraphs`, `targetLanguage`, `webTitle`, `webUrl`, and `webContent` as required strings. Missing extractable context becomes `""`. Unknown variables produce a warning at template save time but do not block saving. Runtime rendering leaves an explicit field diagnostic rather than silently substituting. `webContent` is bounded to 2000 UTF-16 code units.

- **LLM configuration**: One active OpenAI-compatible configuration with `provider`, `baseUrl`, `model`, and optional `temperature`. Public config and API-key secret are stored separately. The options UI can replace but not read back the key. Content scripts never receive the key. Manifest declares `https://*/*` and `http://*/*` as `optional_host_permissions`. Permission is requested for `<origin>/*` only during an explicit save or test gesture. The background permits requests only to the configured and granted origin.

- **Dictionary adapter rollout**: MVP targets `youdao-web` and `cambridge-web` behind one normalized `DictionaryClient` boundary, but rollout is sequential. The first adapter must reach stable acceptance before the second begins. No aggregation or automatic fallback. The active adapter is explicit in extension settings.

- **Fixed vocabulary schema**: System-owned, not user-editable in MVP. Fields: `term` (system/text), `phonetic` (dictionary/text), `partOfSpeech` (dictionary/text), `meaning` (dictionary/text), `examples` (llm/list), `synonyms` (dictionary/list), `wordForms` (dictionary/list). Value shape is determined by the field key. A ready `text` field contains a string; a ready `list` field contains `readonly string[]`.

- **Canonical key**: For source language `en`: reject selection > 500 UTF-16 code units, apply NFKC, trim outer Unicode whitespace and collapse internal runs to one ASCII space, reject empty, lowercase with `en-US` locale, prefix with `en:`. No lemmatization, stemming, punctuation rewriting, or singularization. `VocabularyItem.term` stores the NFKC/whitespace-normalized term with user's casing preserved.

- **Vocabulary context deduplication**: Identity uses `vocabularyItemId`, normalized page URL (URL parser, clear credentials, lowercase scheme/host, remove default ports and fragment, preserve path/query/order), and normalized sentence (NFKC, outer trim, internal whitespace collapse, preserve case/punctuation). Unavailable sentence is `""`. Deterministic context ID derived from the three components.

- **Local data model**: `VocabularyItem`, `VocabularyField`, `VocabularyContext`, and `LearningCard` are syncable with `SyncMetadata` (`createdAt`, `updatedAt`, `recordVersion`, optional `deletedAt`). `EnrichmentJob` is extension-local with no sync metadata. `recordVersion` starts at 1 and increments per committed semantic change. IDs are client-generated strings. Deterministic IDs for stable derived records; unique event IDs for review logs (not created in MVP).

- **Storage indexes**: `vocabulary_items` (pk `id`, unique `canonicalKey`, indexes `language`, `sync.updatedAt`); `vocabulary_fields` (pk `id`, unique `vocabularyItemId + key`, indexes `vocabularyItemId`, `key`, `status`); `vocabulary_contexts` (pk `id`, indexes `vocabularyItemId`, `pageUrl`); `learning_cards` (pk `id`, unique `vocabularyItemId + cardType`); `enrichment_jobs` (pk `id`, indexes `status + nextRunAt`, `vocabularyItemId`, `fieldKey`).

- **Extension settings**: `activeQueryTemplateId`, `targetLanguage` (default `"zh-CN"`), `highlightEnabled` (default `true`), `themeMode` (default `"system"`), optional `activeDictionaryProvider`. Default system template seeds idempotently.

- **Learning cards**: MVP generates only meaning-recall cards after both `term` and `meaning` fields are ready. Cards reference vocabulary fields for rendering rather than storing snapshots. `LearningState` and `ReviewLog` are not created until review behavior exists.

- **Highlighting**: Case-insensitive for English, full word boundaries, no lemmatization, no cross-node phrase matching, longest valid term wins on overlap. Skips extension-owned, interactive, editable, code, hidden, and already-highlighted regions. Initial scan followed by bounded incremental scanning. Disabling restores original text without replacing `innerHTML`. Visible treatment is a wavy underline.

- **Privacy and secrets**: All external requests originate in the background service worker. API keys are read only by background-owned LLM paths, used only for the configured origin, and never appear in messages, logs, errors, analytics, fixtures, or packaged source. Page content is transient, bounded before messaging and request construction, and not stored in logs or caches.

- **Service worker correctness**: Must not depend on module-level mutable state. Listeners are registered synchronously at module startup. Asynchronous handlers keep the response channel alive using one consistent WXT-compatible pattern.

## Testing Decisions

- **Test philosophy**: Test external behavior at the highest seam possible. Prefer existing seams over new ones. Do not test implementation details. Default tests make no live provider requests.

- **Primary seam**: `packages/core` — storage-neutral domain contracts. This is the highest seam and should contain most domain logic tests. Core contracts must not import WXT, React, Dexie, or browser APIs.

- **Repository seam**: `apps/extension/src/repositories` — Dexie/IndexedDB adapters. Tests cover first save, repeated save (idempotency), database reopen (data survives new service instance), canonical-key uniqueness, and transaction atomicity.

- **Messaging seam**: `apps/extension/src/services` — background message handlers. Tests cover valid, malformed, and unknown requests; payload validation at the boundary; stable non-secret error responses; and listener registration at module startup.

- **Content and UI seam**: `apps/extension/src/selection` — content script selection, panel, and positioning. Tests cover no automatic query before trigger, explicit trigger query, ordered field rendering, field failure states, saved state, Esc and outside-click close, narrow viewport reachability, and stale result handling.

- **Enrichment seam**: `apps/extension/src/enrichment` — background enrichment queue. Tests cover job creation, per-field retry, status tracking, restart safety, and learning card generation after term and meaning are ready.

- **LLM client seam**: `apps/extension/src/llm` — OpenAI-compatible client. Tests cover request construction, response parsing, error handling, and API-key isolation (key never in logs or errors).

- **Highlighting seam**: `apps/extension/src/highlighting` — page highlighter. Tests cover case-insensitive matching, word boundaries, longest-term overlap, skipped regions, incremental scanning, and disable/restore behavior.

- **Options UI seam**: `apps/extension/src/options` — settings and template management. Tests cover template CRUD, field editing, LLM config save with permission request, permission denial recovery, and theme/target-language changes.

- **Integration seam**: End-to-end fixture-page integration test covering the full scenario: select, confirm no request, click trigger, receive ordered fields, save, reload, verify highlight.

- **Prior art**: Existing test files in `packages/core/src/**/*.test.ts`, `apps/extension/src/repositories/local-repositories.test.ts`, `apps/extension/src/selection/selection.test.ts`, `apps/extension/src/enrichment/enrichment-queue.test.ts`, and `apps/extension/src/llm/openai-compatible-client.test.ts` establish the testing patterns.

- **Verification commands**: `pnpm test`, `pnpm typecheck`, and `pnpm build` must pass before issue closure. Browser acceptance requires the extension to load in unpacked Chrome and pass the manual acceptance script.

## Out of Scope

- Mobile app, accounts, cloud sync, sync APIs, and mobile clients.
- `LearningState`, `ReviewLog`, scheduler, review algorithm, review UI, check-ins, and review actions.
- Lemmatization, stemming, word-form matching, cross-node phrase matching, and multi-dictionary lookup.
- Bundled offline dictionary data.
- Saved-vocabulary field customization, editing, notes, schema customization, or management dashboard.
- Import/export of vocabulary data or query templates.
- UI-language expansion beyond the current UI language.
- New appearance customization beyond theme mode.
- Multiple LLM profiles or per-template model configuration.
- Provider fallback or dictionary aggregation.
- Local MDX or markdown field types.
- iframe, Shadow DOM, SPA, and dynamic-page highlighting hardening (deferred beyond MVP).

## Further Notes

- **Phase plan**: The MVP is implemented in 8 ordered phases. Phase 01 (freeze spec) and Phase 02 (local vertical slice) are complete. Phase 03 (OpenAI-compatible translation) is next. Phases 04-08 cover enrichment, templates/settings, dictionary adapters, highlighting hardening, and release hardening.

- **Dictionary adapter order**: The first adapter is selected based on current access reliability and required-field coverage. The second begins only after the first satisfies Phase 06 exit criteria.

- **Open non-blocking questions**: (1) Which dictionary adapter is implemented first — deferred to Phase 06 implementer. (2) Whether Phase 05 includes a read-only vocabulary-schema view — optional, does not block acceptance. (3) Whether the second dictionary adapter ships in the same release — deferred to Phase 06 product owner.

- **Definition of done**: Every phase must satisfy: preconditions and acceptance criteria written before implementation; tests at agreed public seams fail before behavior exists; implementation does not broaden scope; errors are explicit and do not expose secrets; tests pass; `pnpm test`, `pnpm typecheck`, and `pnpm build` pass; browser acceptance script passes; security/privacy effects recorded; documentation updated; change committed as one coherent stack.

- **Engineering guardrails**: Content scripts own page interaction and typed calls only. Background owns IndexedDB writes, secrets, external requests, and jobs. Query templates and vocabulary fields remain separate models. Provider behavior remains behind adapters. API keys and full page content never appear in logs, errors, or artifacts. DOM scans remain bounded and incremental. Database rollback never clears user data; schema changes use forward migrations.
