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
- **Saved-word schema**: The fixed system-owned schema for saved word fields. Users can hide or disable saving fields but cannot redefine them.
- **Word item**: The identity record for a saved word. It drives deduplication, highlighting, and future learning state.
- **Word field**: A saved-word field value and its field-level enrichment state.
- **Enrichment job**: A background task that fills one saved-word field via dictionary or LLM.
- **Canonical key**: The stable saved-word identity key, such as `en:running`. MVP v0.1 does not perform lemmatization.

## Current Product Decisions

- MVP v0.1 focuses on the browser extension only.
- Mobile app, sync, check-ins, and review algorithms are deferred.
- Selection translation and saved-word storage use separate schemas and separate execution paths.
- Query templates are editable by users.
- Saved-word schema is fixed by the system.
- Saving a word succeeds immediately and enriches fields asynchronously.
- Local storage uses IndexedDB, preferably via Dexie.
- The extension stack is WXT.js, React, and TypeScript.
