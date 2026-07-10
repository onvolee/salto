# Salto Context

Salto is a browser extension for reading-time translation, word saving, and later vocabulary learning.

## Glossary

- **Selection**: The text selected by the user on a web page. MVP v0.1 supports words and short phrases up to 500 characters.
- **Floating trigger**: The small UI shown near a selection before any lookup runs. Clicking it starts translation.
- **Translation panel**: The floating panel anchored near the selection that displays query template output.
- **Query template**: A user-editable ordered schema for selection translation output. Each field chooses an LLM or dictionary source.
- **Query schema field**: One output block inside a query template. It has a label, type, source, instruction, order, and enabled state.
- **Prompt context**: The runtime variables available to LLM instructions, such as selection, sentence, target language, page title, URL, and page content.
- **Saved word**: A canonical word entry saved for later learning. It is separate from a translation panel result.
- **Vocabulary item**: The syncable identity record for a word or phrase that can be translated, enriched, highlighted, and studied. A saved word creates or reuses a vocabulary item.
- **Vocabulary field**: A syncable vocabulary attribute such as phonetic text, part of speech, meaning, examples, synonyms, or word forms. Each field can be enriched and synced independently.
- **Vocabulary context**: A syncable record of the reading context in which a vocabulary item was saved, such as sentence, paragraph, page title, and page URL.
- **Learning card**: A syncable study unit generated from a vocabulary item or vocabulary field for review.
- **Learning state**: The current scheduling and memory state of a learning card.
- **Review log**: An append-only record of one review action for a learning card.
- **Saved-word schema**: The fixed system-owned schema for saved word fields. Users can hide or disable saving fields but cannot redefine them.
- **Word item**: The identity record for a saved word. It drives deduplication, highlighting, and future learning state.
- **Word field**: A saved-word field value and its field-level enrichment state.
- **Enrichment job**: A background task that fills one saved-word field via dictionary or LLM.
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
- MVP supports lightweight Web dictionary adapters for `youdao-web` and `cambridge-web`; neither adapter is a domain dependency.
- MVP supports one active OpenAI-compatible LLM configuration stored as extension-local settings.
- LLM API keys are extension-local secrets used only by background request paths; content scripts never receive them.
- MVP validation targets Chrome and Chromium while implementation keeps browser APIs behind WXT boundaries where practical.
- Core syncable model names use `Vocabulary*`; saved word remains user-facing language for the save action.
- Re-saving an existing vocabulary item can append a deduplicated vocabulary context instead of creating another vocabulary item.
- Browser extension and mobile clients share one syncable Vocabulary and Learning model, implemented with platform-specific storage adapters.
- Vocabulary and learning data use multiple responsibility-specific records rather than one large word record.
- Review logs record review events, while learning state records the current schedule and memory state for a learning card.
- MVP generates only meaning-recall learning cards.
- Meaning-recall cards are generated only after both term and meaning fields are ready.
- MVP learning cards reference vocabulary fields for rendering instead of storing full front/back content snapshots.
- Future sync includes vocabulary and learning assets, not browser-extension workspace data such as query templates, LLM configuration, enrichment jobs, highlight settings, or UI state.
- Syncable records use client-generated string identifiers; stable derived records use deterministic IDs, while review logs use unique event IDs.
- MVP is local-first and sync-ready, but does not implement accounts, cloud sync, sync APIs, or mobile clients.
- MVP does not include user-facing or debug import/export.
- Local storage uses IndexedDB, preferably via Dexie.
- The extension stack is WXT.js, React, TypeScript 7.x, Dexie, and Vitest, implemented as `apps/extension` plus storage-neutral core contracts in `packages/core`.
