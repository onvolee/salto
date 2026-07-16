# Phase 02: Build The Local Vertical Slice

Status: ready-for-human

Depends on: Phase 01

## Outcome

In a deterministic development build, a user can select text, intentionally open the panel, receive fake translation fields, save the selection, reload the page, and see a basic saved-vocabulary highlight.

This is the first architecture proof. It must use the real message, service, repository, and IndexedDB boundaries, but deterministic fake providers. Fake providers are dependency-injected test and development tools, not a production fallback.

## End-To-End Scenario

1. Select an English word or short phrase of at most 500 characters.
2. Confirm that selection alone sends no translation request.
3. Click the floating trigger.
4. Receive ordered fake output from the default query template.
5. Save the selection and receive immediate saved state.
6. Reload the page.
7. Confirm that the saved term has a simple exact-match underline.

## Core Contract Tasks

- [x] Align query-template and vocabulary types exactly with the frozen contracts in the PRD: `text | list`, provider-neutral query sources, ID-based `Vocabulary*` relationships, and schema-governed vocabulary values.
- [x] Add typed selection-translation request and `QueryFieldResult` contracts using the frozen required-string `PromptContext` mapping.
- [x] Represent success and failure per query field.
- [x] Seed the PRD's exact `DEFAULT_EXTENSION_SETTINGS` and `DEFAULT_QUERY_TEMPLATE` values idempotently.
- [x] Add injectable clock and ID-generation boundaries where deterministic tests need them.
- [x] Keep all contracts storage- and browser-adapter neutral.

## Storage Tasks

- [x] Add only the tables required by this slice: vocabulary items, fields, contexts, templates, and minimal settings.
- [x] Implement the minimum repository operations used by translate, save, and highlight-term reads.
- [x] Enforce the frozen `en:` canonicalization behavior and canonical-key uniqueness at the repository transaction boundary.
- [x] Store the system `term` field as ready during save.
- [x] Seed defaults idempotently on extension installation and on missing-data recovery.
- [x] Test a database reopen to prove data survives a new service instance.

## Messaging And Service Tasks

- [x] Define one discriminated request/response protocol for the slice.
- [x] Validate message payloads at the background boundary.
- [x] Implement `translateSelection`, `saveVocabulary`, and `listHighlightTerms` handlers.
- [x] Register service-worker listeners synchronously at module startup.
- [x] Ensure asynchronous handlers keep the response channel alive using one consistent WXT-compatible pattern.
- [x] Reject unknown message types and invalid payloads with stable, non-secret error responses.

## Content And UI Tasks

- [x] Reuse the existing selection trigger and panel positioning behavior.
- [x] Extract every frozen `PromptContext` value, using empty strings for unavailable context and bounding `webContent` to 2000 UTF-16 code units.
- [x] Render template name and fields in schema order.
- [x] Render loading, complete, partial-error, and request-error states without resizing the panel unpredictably.
- [x] Enable the existing save action and make repeated clicks idempotent.
- [x] Preserve selection until deliberate close and preserve current `Esc` and outside-click behavior.
- [x] Add a minimal single-pass highlighter used only to prove persisted readback.

## Automated Verification

- [x] Core contract tests cover list, text, unavailable, and failed field results.
- [x] Repository tests cover first save, repeated save, and database reopen.
- [x] Message tests cover valid, malformed, and unknown requests.
- [x] UI tests cover no automatic query, explicit trigger query, ordered rendering, field failure, and saved state.
- [x] Content extraction tests cover missing sentence, long page content, and selections near DOM boundaries.
- [x] A fixture-page integration test covers the complete seven-step scenario.
- [x] Default tests make no remote network requests.

## Manual Browser Acceptance

1. Build and load the unpacked extension in Chrome.
2. Open the fixed local fixture and select a valid term.
3. Verify no request occurs before trigger activation.
4. Open the panel and inspect deterministic ordered fields.
5. Save, close, and reload the page.
6. Verify saved state is persisted and the exact term is underlined.
7. Restart the extension service worker and repeat the readback.

## Exit Criteria

- [x] The complete local scenario passes without a live provider.
- [x] Content and UI code do not import Dexie or read API-key storage.
- [x] A service-worker restart does not lose persisted behavior.
- [x] Fake providers cannot be selected accidentally in a production build.
- [x] Full test, typecheck, and build commands pass.

## Non-Goals

- Real LLM or dictionary requests
- Background enrichment processing
- Full template management
- Dynamic-page highlighting performance
- Appearance or UI-language expansion

## Rollback Boundary

The slice should be revertible as one coherent stack: contracts and storage first, background messaging second, UI integration last. Reverting the UI must not require deleting persisted vocabulary tables.

## Comments

- 2026-07-16: Created from the ordered MVP development plan.
- 2026-07-16: Implemented the local vertical slice. `pnpm test`, `pnpm typecheck`, and `pnpm build` pass; the extension suite contains 58 passing tests. A Chrome for Testing run loaded `.output/chrome-mv3-dev`, selected `unfamiliar` on `fixtures/local-vertical-slice.html`, confirmed no panel before the explicit trigger, rendered the ordered deterministic fields, saved the term, reloaded the page, and observed one persisted `wavy` highlight. The production bundle contains no fake executor strings. Prompt-context extraction details were frozen in ADR 0031; iframe, Shadow DOM, SPA, and dynamic-page hardening remain deferred.
