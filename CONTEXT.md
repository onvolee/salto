# Salto Context

Salto is a browser extension for reading-time translation, word saving, and later vocabulary learning.

## Glossary

- **Selection**: The text selected by the user on a web page. MVP v0.1 supports words and short phrases up to 500 characters.
- **Selection translation**: The explicit reading-time query that turns a selection and its prompt context into transient query-field results.
- **Floating trigger**: The small UI shown near a selection before any lookup runs. Clicking it starts translation.
- **Translation panel**: The floating panel anchored near the selection that displays query template output.
- **Query template**: A user-editable ordered schema for selection translation output. Each field chooses an LLM or dictionary source.
- **Query schema field**: One output block inside a query template. It has common label, source, order, and enabled state plus either an LLM type/instruction or a normalized dictionary field with a derived type.
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
- **Extension setting**: Extension-local workflow configuration such as the active query template, target language, active dictionary adapter, highlighting, or theme mode; it is not syncable vocabulary data.
- **Saved-vocabulary highlighting**: The page behavior that marks terms belonging to saved vocabulary items without changing vocabulary records.
- **Canonical key**: The stable saved-word identity key, such as `en:running`. MVP v0.1 does not perform lemmatization.

## Current Product Decisions

- MVP v0.1 focuses on the browser extension only.
- Mobile app, sync, check-ins, and review algorithms are deferred.
- Selection translation and saved-word storage use separate schemas and separate execution paths.
- Translation panel results are transient reading output and do not populate vocabulary fields.
- Query templates are editable by users.
- Query templates are extension-local reading-time translation schemas and do not create syncable vocabulary fields.
- Saved-word schema is fixed by the system.
- Vocabulary field keys, sources, display behavior, and field values are fixed in MVP; users cannot hide, add, delete, redefine, edit, or change field sources.
- Saving a word succeeds immediately and enriches fields asynchronously.
- Vocabulary enrichment status and retry behavior are tracked per field, while execution may batch fields by provider.
- MVP targets lightweight Web dictionary adapters for `youdao-web` and `cambridge-web`; the first must reach stable acceptance before work begins on the second, and neither adapter is a domain dependency.
- MVP supports one active OpenAI-compatible LLM configuration stored as extension-local settings.
- LLM API keys are extension-local secrets used only by background request paths; content scripts never receive them.
- MVP validation targets Chrome and Chromium while implementation keeps browser APIs behind WXT boundaries where practical.
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
- Future sync includes vocabulary and learning assets, not browser-extension workspace data such as query templates, LLM configuration, enrichment jobs, highlight settings, or UI state.
- User-entered LLM origins use optional host permissions requested for the exact configured origin during an explicit options-page gesture.
- Syncable records use client-generated string identifiers and `recordVersion` revision metadata; stable derived records use deterministic IDs, while review logs use unique event IDs.
- MVP is local-first and sync-ready, but does not implement accounts, cloud sync, sync APIs, or mobile clients.
- MVP does not include user-facing or debug import/export.
- Local storage uses IndexedDB, preferably via Dexie.
- The extension stack is WXT.js, React, TypeScript 7.x, Dexie, and Vitest, implemented as `apps/extension` plus storage-neutral core contracts in `packages/core`.
