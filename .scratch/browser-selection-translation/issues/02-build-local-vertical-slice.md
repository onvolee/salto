# Phase 02: Build The Local Vertical Slice

Status: ready-for-agent

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

- [ ] Align query-template and vocabulary types with Phase 01 decisions.
- [ ] Add typed selection-translation request and per-field result contracts.
- [ ] Represent success and failure per query field.
- [ ] Define minimal settings and default query-template values.
- [ ] Add injectable clock and ID-generation boundaries where deterministic tests need them.
- [ ] Keep all contracts storage- and browser-adapter neutral.

## Storage Tasks

- [ ] Add only the tables required by this slice: vocabulary items, fields, contexts, templates, and minimal settings.
- [ ] Implement the minimum repository operations used by translate, save, and highlight-term reads.
- [ ] Enforce canonical-key uniqueness at the repository transaction boundary.
- [ ] Store the system `term` field as ready during save.
- [ ] Seed defaults idempotently on extension installation and on missing-data recovery.
- [ ] Test a database reopen to prove data survives a new service instance.

## Messaging And Service Tasks

- [ ] Define one discriminated request/response protocol for the slice.
- [ ] Validate message payloads at the background boundary.
- [ ] Implement `translateSelection`, `saveVocabulary`, and `listHighlightTerms` handlers.
- [ ] Register service-worker listeners synchronously at module startup.
- [ ] Ensure asynchronous handlers keep the response channel alive using one consistent WXT-compatible pattern.
- [ ] Reject unknown message types and invalid payloads with stable, non-secret error responses.

## Content And UI Tasks

- [ ] Reuse the existing selection trigger and panel positioning behavior.
- [ ] Extract selection, sentence, nearby paragraphs, title, URL, and bounded page content.
- [ ] Render template name and fields in schema order.
- [ ] Render loading, complete, partial-error, and request-error states without resizing the panel unpredictably.
- [ ] Enable the existing save action and make repeated clicks idempotent.
- [ ] Preserve selection until deliberate close and preserve current `Esc` and outside-click behavior.
- [ ] Add a minimal single-pass highlighter used only to prove persisted readback.

## Automated Verification

- [ ] Core contract tests cover list and text field results.
- [ ] Repository tests cover first save, repeated save, and database reopen.
- [ ] Message tests cover valid, malformed, and unknown requests.
- [ ] UI tests cover no automatic query, explicit trigger query, ordered rendering, field failure, and saved state.
- [ ] Content extraction tests cover missing sentence, long page content, and selections near DOM boundaries.
- [ ] A fixture-page integration test covers the complete seven-step scenario.
- [ ] Default tests make no remote network requests.

## Manual Browser Acceptance

1. Build and load the unpacked extension in Chrome.
2. Open the fixed local fixture and select a valid term.
3. Verify no request occurs before trigger activation.
4. Open the panel and inspect deterministic ordered fields.
5. Save, close, and reload the page.
6. Verify saved state is persisted and the exact term is underlined.
7. Restart the extension service worker and repeat the readback.

## Exit Criteria

- [ ] The complete local scenario passes without a live provider.
- [ ] Content and UI code do not import Dexie or read API-key storage.
- [ ] A service-worker restart does not lose persisted behavior.
- [ ] Fake providers cannot be selected accidentally in a production build.
- [ ] Full test, typecheck, and build commands pass.

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
