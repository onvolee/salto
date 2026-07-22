# Salto Context

Salto is a browser extension for reading-time translation, word saving, and later vocabulary learning.

## Glossary

- **Selection**: The text selected by the user on a web page. MVP v0.1 supports words and short phrases up to 500 characters.
- **Selection translation**: The explicit reading-time query that turns a selection and its prompt context into transient query-field results.
- **Floating trigger**: The small UI shown near a selection before any lookup runs. Clicking it starts translation.
- **Translation panel**: The floating panel anchored near the selection that displays query template output. Its size can be manually adjusted from the right edge, bottom edge, or bottom-right corner.
- **Query template**: A user-editable ordered schema for selection translation output. Each field chooses an LLM or dictionary source.
- **Template field definition**: A reusable authoring preset for a query-template output field. It supplies the label, optional description, source, type, and either an LLM instruction or a normalized dictionary field. Its description is shown in field-library and template configuration views when present, not in translation-panel results.
- **Query schema field**: One output block inside a saved query template. It is a snapshot created from a template field definition and has its own order and enabled state plus the copied definition.
- **Query field result**: The ready text, ready list, unavailable value, or field-level failure returned for one query schema field.
- **Prompt context**: The runtime variables available to LLM instructions, such as selection, sentence, target language, page title, URL, and page content.
- **Saved word**: User-facing language for the save action and saved state. Its durable identity record is a vocabulary item, separate from translation-panel output.
- **Vocabulary item**: The syncable identity record for a word or phrase that can be translated, enriched, highlighted, and studied. A saved word creates or reuses a vocabulary item.
- **Vocabulary field**: A syncable vocabulary attribute such as phonetic text, part of speech, meaning, examples, synonyms, or word forms. Each field can be enriched and synced independently.
- **Vocabulary context**: A syncable record of the reading context in which a vocabulary item was saved, such as sentence, paragraph, page title, and page URL.
- **Vocabulary enrichment**: The background-owned process that populates fixed vocabulary fields independently from translation-panel output.
- **Learning card**: A syncable study unit generated from a vocabulary item or vocabulary field for review.
- **Meaning-recall card**: The MVP learning card that shows the ready term field and recalls the ready meaning field.
- **Learning state**: The current scheduling and memory state of a learning card.
- **Review log**: An append-only record of one review action for a learning card.
- **Saved-word schema**: The fixed system-owned vocabulary-field schema. Users cannot hide, add, delete, redefine, edit, reorder, or change field sources in MVP.
- **Enrichment job**: An extension-local background task that fills one vocabulary field through its dictionary or LLM source.
- **OpenAI-compatible LLM configuration**: The one extension-local provider origin, model, options, and separately stored API-key secret used by background LLM requests.
- **Dictionary adapter**: An extension-owned integration that maps one Web dictionary provider into Salto's normalized lookup contract.
- **Database inspector**: A deferred personal, read-only extension page for quickly browsing all current IndexedDB tables and their records. It is a table browser, not a vocabulary-management or data-editing interface.
- **Extension setting**: Extension-local workflow configuration such as the active query template, target language, active dictionary adapter, highlighting, theme mode, or translation-panel size; it is not syncable vocabulary data.
- **Saved-vocabulary highlighting**: The page behavior that marks saved vocabulary without changing vocabulary records. It can mark an original saved selection location or, when same-word highlighting is enabled, all matching occurrences of a saved term.
- **Same-word highlighting**: The optional page-wide matching mode of saved-vocabulary highlighting. When disabled, only a saved selection's original location may be marked; an unavailable or changed location does not fall back to matching identical words elsewhere on the page.
- **Canonical key**: The stable saved-word identity key, such as `en:running`. MVP v0.1 does not perform lemmatization.

## Current Product Decisions

- MVP v0.1 focuses on the browser extension only.
- Mobile app, sync, check-ins, and review algorithms are deferred.
- Selection translation and saved-word storage use separate schemas and separate execution paths.
- Salto's core experience joins reading-time understanding with intentional vocabulary learning: a completed selection translation is independently successful, while saving is the user's explicit choice to add a term to a future long-term learning loop.
- Translation panel results are transient reading output and do not populate vocabulary fields.
- Query templates are editable by users.
- Query templates are extension-local reading-time translation schemas and do not create syncable vocabulary fields.
- The translation panel starts with the current `360 x 220` minimum size. Users may resize it from the right edge, bottom edge, or bottom-right corner; its maximum stays within the viewport with an 8px margin, its top-left position remains stable while resizing, and the last chosen size is saved as a global extension setting.
- The system default template is read-only and always retains at least one enabled field; users copy it before changing its field composition.
- Every template must retain at least one enabled field.
- A template field definition is copied into a template when selected. Later edits or deletion of the definition never alter saved templates that were created from it.
- A template field definition can be deleted after confirmation. Deletion removes it only from the field library and never changes field snapshots already saved in templates.
- A saved template manages only its field snapshots' inclusion, enabled state, and order. Labels, descriptions, sources, types, and instructions are not editable from the template page.
- A template may include the same template field definition more than once. Each inclusion creates a distinct field snapshot with its own result identity, enabled state, and order.
- Template field definitions are not ordered; only the snapshots selected into a template are ordered.
- A template field snapshot owns its presentation style. Templates may edit this style independently for each snapshot without changing its label, description, source, type, or instruction, and without affecting other templates or the source definition.
- Each template field snapshot has editable Key CSS and Value CSS declaration blocks. Its appearance editor presents both inputs beside a live preview of the complete current template in the selection panel; edits apply to the template draft, while the outer template save persists them. Resetting clears only that snapshot's CSS.
- Saved-word schema is fixed by the system.
- Vocabulary field keys, sources, display behavior, and field values are fixed in MVP; users cannot hide, add, delete, redefine, edit, or change field sources.
- Saving a word succeeds immediately and enriches fields asynchronously.
- Vocabulary enrichment status and retry behavior are tracked per field, while execution may batch fields by provider.
- MVP targets lightweight Web dictionary adapters for `youdao-web` and `cambridge-web`; the first must reach stable acceptance before work begins on the second, and neither adapter is a domain dependency.
- MVP supports one active OpenAI-compatible LLM configuration stored as extension-local settings.
- Settings-page navigation is hash-routed: `#/general`, `#/translate-template`, `#/translation-sources`, `#/vocabulary`, and `#/api-providers` identify the active section. The hash is the source of truth, browser history stays synchronized, and missing or unknown hashes resolve to `#/general`.
- The `#/translate-template` section contains `Templates` and `Template fields` tabs. `#/translate-template` selects `Templates` by default, while `#/translate-template/fields` selects `Template fields`; both participate in hash navigation history.
- Each settings section has a non-interactive, right-aligned status item that presents one current, truthful section summary without adding background probes or persisted verification. General shows save state; selection translation shows the active template; sources show the active dictionary and only this-session connection-test outcomes; vocabulary shows failed-enrichment count or completion; and AI shows configuration state and only this-session connection-test outcomes. Green is reserved for verified success or completion, gray for ordinary summaries, yellow for attention, and red for failure.
- The Sources section's Youdao test uses an editable `example` test word and executes a real provider lookup. A successful current-session test exposes a `View result` action; it opens a single-column, vertically scrollable dialog showing the tested entry's complete provider-returned content in source-native sections. Repeated source content remains structured as independent entries rather than one flattened text block: word forms preserve label/value pairs, phrases preserve phrase/meaning pairs, and examples preserve English text, Chinese text, and source. The dialog has no side navigation, split-pane layout, audio playback, or save action, and each later successful test replaces the displayed result.
- LLM API keys are extension-local secrets used only by background request paths; content scripts never receive them.
- MVP validation targets Chrome and Chromium while implementation keeps browser APIs behind WXT boundaries where practical.
- Saved-vocabulary highlighting has a master switch and a same-word-highlighting switch. Same-word highlighting defaults to off; the master switch controls all highlighting, while disabling same-word highlighting leaves only original saved selection locations eligible to be marked.
- Core syncable model names use `Vocabulary*`; saved word remains user-facing language for the save action.
- Query schema field types are `text | list`; query results preserve that value shape and isolate failures per field.
- Prompt templates expose `selection`, `sentence`, `paragraphs`, `targetLanguage`, `webTitle`, `webUrl`, and `webContent` through one required-string `PromptContext` shape.
- English canonical keys use NFKC normalization, collapsed whitespace, and fixed English lowercase without lemmatization or punctuation rewriting.
- Re-saving an existing vocabulary item can append a deduplicated vocabulary context instead of creating another vocabulary item.
- Vocabulary-context identity uses vocabulary item ID, normalized page URL, and normalized sentence context.
- Browser extension and mobile clients share one syncable Vocabulary and Learning model, implemented with platform-specific storage adapters.
- Vocabulary and learning data use multiple responsibility-specific records rather than one large word record.
- Review logs record review events, while learning state records the current schedule and memory state for a learning card.
- MVP generates only meaning-recall learning cards.
- Meaning-recall cards are generated only after both term and meaning fields are ready.
- MVP learning cards reference vocabulary fields for rendering instead of storing full front/back content snapshots.
- MVP persists vocabulary and learning-card metadata but does not expose review UI, review actions, a scheduler, or a review algorithm; those belong to the next phase.
- The deferred database inspector has a table sidebar and a record view, loads on open and when the selected table changes, and has an explicit manual refresh control with no automatic polling or live subscription. Its intended raw-data access, including `llmSecrets`, conflicts with the current API-key UI boundary and requires ADR review before implementation.
- Future sync includes vocabulary and learning assets, not browser-extension workspace data such as query templates, LLM configuration, enrichment jobs, highlight settings, or UI state.
- User-entered LLM origins use optional host permissions requested for the exact configured origin during an explicit options-page gesture.
- Syncable records use client-generated string identifiers and `recordVersion` revision metadata; stable derived records use deterministic IDs, while review logs use unique event IDs.
- MVP is local-first and sync-ready, but does not implement accounts, cloud sync, sync APIs, or mobile clients.
- MVP does not include user-facing or debug import/export.
- Local storage uses IndexedDB, preferably via Dexie.
- The extension stack is WXT.js, React, TypeScript 7.x, Dexie, and Vitest, implemented as `apps/extension` plus storage-neutral core contracts in `packages/core`.
