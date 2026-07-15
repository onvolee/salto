# Browser Selection Translation MVP PRD

Status: ready-for-agent

## Summary

Build Salto MVP v0.1 as a browser extension for reading-time translation and saved-word collection.

The user selects a word or short phrase on a web page, opens a selection-adjacent translation panel through a floating trigger or shortcut, reads configurable LLM/dictionary output, and saves words for later learning. Saved words are stored locally, enriched in the background, and highlighted on pages with a wavy underline.

## Goals

- Help users understand selected words or short phrases while reading.
- Support configurable selection translation output.
- Allow LLM and dictionary fields to be mixed in one query template.
- Save words without interrupting reading.
- Enrich saved-word fields asynchronously.
- Highlight saved words on web pages.
- Keep data local in MVP v0.1 while reserving fields for future sync.

## Non-Goals

- Mobile app.
- Cross-device sync.
- Login/account system.
- Cloud backend.
- Review algorithm.
- Check-ins.
- Lemmatization or word-form matching.
- Multi-dictionary aggregation.
- Bundled offline dictionary database.

## User Flow

1. User selects text on a web page.
2. Extension shows a floating trigger near the selection.
3. User clicks the trigger or presses a shortcut.
4. Extension opens a floating translation panel near the selection.
5. Extension executes the active query template.
6. LLM fields are grouped into one LLM request.
7. Dictionary fields are grouped into one dictionary lookup.
8. Results are rendered in schema order.
9. User saves the selected word.
10. Extension immediately creates a saved word.
11. Background enrichment jobs fill saved-word fields.
12. Saved words are highlighted on pages.

## Selection Translation

Selection support:

- Words.
- Short phrases.
- Maximum 500 characters.

The extension must not query automatically on selection. It must show a floating trigger first.

Translation panel behavior:

- Anchors near the selection.
- Flips near viewport edges.
- Shows active query template name.
- Supports template switching.
- Displays schema fields in order.
- Includes save action.
- Includes refresh/regenerate action.
- Closes on outside click or `Esc`.

## Query Templates

Users can:

- Create templates.
- Copy templates.
- Delete user-created templates.
- Edit field labels.
- Edit field instructions.
- Edit field source.
- Reorder fields.
- Set a default template.

```ts
type QueryTemplate = {
  id: string
  name: string
  fields: QuerySchemaField[]
  createdAt: string
  updatedAt: string
}

type QuerySchemaField = {
  id: string
  label: string
  type: "text" | "list"
  source: "llm" | "dictionary"
  instruction: string
  order: number
  enabled: boolean
}
```

Field types:

- `text`: a single string.
- `list`: `string[]` only in MVP v0.1.

Execution rules:

- Merge all enabled LLM fields in a template into one LLM request.
- Merge all enabled dictionary fields in a template into one dictionary lookup.
- Display output in the original schema order.
- Field failure only affects that field.

## Prompt Variables

LLM field instructions support variable insertion by button and manual typing.

```ts
type PromptContext = {
  selection: string
  sentence: string
  paragraphs: string
  targetLanguage: string
  webTitle: string
  webUrl: string
  webContent: string
}
```

Variables:

- `{{selection}}`: selected text.
- `{{sentence}}`: sentence containing the selection.
- `{{paragraphs}}`: nearby paragraphs.
- `{{targetLanguage}}`: target translation language.
- `{{webTitle}}`: current page title.
- `{{webUrl}}`: current page URL.
- `{{webContent}}`: extracted page body content, truncated to the first 2000 characters.

Unknown variables should produce a warning when saving a field instruction but should not block saving.

## LLM Configuration

MVP v0.1 supports OpenAI-compatible APIs only.

```ts
type LlmConfig = {
  provider: "openai-compatible"
  baseUrl: string
  apiKey: string
  model: string
  temperature?: number
}
```

LLM requests must be made from the extension service worker. Content scripts must not receive or store the API key.

## Dictionary Provider

MVP v0.1 implements lightweight online dictionary providers.

Initial providers:

- Youdao Web adapter.
- Cambridge Web adapter.

Future candidates:

- Collins.
- Local MDX.
- Official dictionary APIs.

```ts
type DictionaryProvider = "youdao-web" | "cambridge-web"
```

Both initial providers are free, lightweight Web adapters. They fetch online dictionary pages or Web endpoints from the extension background request path and parse only the fields Salto needs. They are not official licensed APIs, bundled offline dictionaries, or long-term domain dependencies. Provider-specific HTML, request signing, cookies, anti-abuse behavior, and failure modes must stay behind the dictionary adapter boundary.

## Saved Words

Selection translation output and saved-word storage are separate.

Saving a word must not reuse the current translation panel result. It runs a dedicated saved-word enrichment flow from the saved-word schema.

Save behavior:

- Create the saved word immediately.
- Show saved state immediately.
- Create enrichment jobs for enabled saved-word fields.
- Fill dictionary fields from the dictionary provider.
- Fill LLM fields from the configured LLM.
- Track each field status separately.
- Allow failed fields to be retried later.

The same `canonicalKey` can only create one vocabulary item. A repeated save shows already-saved state, but may append a new deduplicated vocabulary context when the page URL and sentence context differ.

## Saved-Word Schema

Saved-word schema is fixed by the system. Users cannot add, delete, redefine, hide, edit fields, or change field sources in MVP v0.1.

```ts
type SavedWordFieldKey =
  | "term"
  | "phonetic"
  | "partOfSpeech"
  | "meaning"
  | "examples"
  | "synonyms"
  | "wordForms"
```

Initial fields:

```ts
const savedWordSchema = [
  { key: "term", label: "词条", type: "text", source: "system" },
  { key: "phonetic", label: "音标", type: "text", source: "dictionary" },
  { key: "partOfSpeech", label: "词性", type: "text", source: "dictionary" },
  { key: "meaning", label: "释义", type: "text", source: "dictionary" },
  { key: "examples", label: "例句", type: "list", source: "llm" },
  { key: "synonyms", label: "近义词", type: "list", source: "dictionary" },
  { key: "wordForms", label: "词形变化", type: "list", source: "dictionary" },
]
```

## Local Data Model

Use IndexedDB, preferably through Dexie.

```ts
type WordItem = {
  canonicalKey: string
  surfaceText: string
  language: string
  createdAt: string
  updatedAt: string
  mastery?: number
  nextReviewAt?: string | null
  enrichmentStatus: "pending" | "partial" | "ready" | "failed"
  localVersion: number
  syncStatus: "local" | "pending" | "synced" | "conflict"
  lastSyncedAt?: string
  deletedAt?: string
}
```

```ts
type WordField = {
  id: string
  canonicalKey: string
  fieldKey: SavedWordFieldKey
  value: string | string[] | null
  status: "pending" | "ready" | "failed" | "hidden"
  source: "system" | "dictionary" | "llm" | "user"
  updatedAt: string
  error?: string
}
```

```ts
type EnrichmentJob = {
  id: string
  canonicalKey: string
  fieldKey: SavedWordFieldKey
  source: "dictionary" | "llm"
  status: "queued" | "running" | "succeeded" | "failed"
  attempts: number
  nextRunAt: string
  lastError?: string
}
```

Recommended indexes:

```ts
word_items:
  keyPath: canonicalKey
  indexes:
    language
    enrichmentStatus
    nextReviewAt
    updatedAt
    syncStatus

word_fields:
  keyPath: id
  indexes:
    canonicalKey
    fieldKey
    status

enrichment_jobs:
  keyPath: id
  indexes:
    status
    nextRunAt
    canonicalKey
```

## Highlighting

MVP v0.1 highlighting rules:

- Highlight saved words only.
- Case-insensitive English matching.
- Match full word boundaries only.
- Do not lemmatize.
- Do not match across DOM text nodes.
- Skip inputs, buttons, links, code blocks, and other interactive areas.
- Scan once after page load.
- Use throttled incremental scanning for DOM changes.
- Use a wavy underline style.

```css
.salto-word-highlight {
  text-decoration-line: underline;
  text-decoration-style: wavy;
  text-decoration-color: #f59e0b;
  text-underline-offset: 3px;
  cursor: pointer;
}
```

## Settings Page

MVP v0.1 settings sections:

- LLM configuration.
- Query template management.
- Saved-word field settings.
- Highlight settings.
- Appearance settings.
- Language settings.

Appearance settings:

- Follow system / light / dark.
- Theme color.

Language settings:

- UI language.
- Target translation language.

UI language controls extension text. Target translation language controls LLM and translation output.

## Technical Baseline

Tech stack:

- WXT.js.
- React.
- TypeScript 7.x.
- IndexedDB.
- Dexie.
- Vitest.

Implementation boundary: see `docs/adr/0030-implement-mvp-stack-with-wxt-workspace-boundaries.md`.

Entrypoints:

```text
entrypoints/
  background.ts
    Service worker for enrichment jobs, LLM requests, dictionary requests, and IndexedDB writes.

  content.ts
    Text selection, floating trigger, selection panel, page highlighting, and messaging.

  options/
    Settings page for LLM config, query templates, saved-word fields, highlighting, appearance, and language.
```

Data access should be centralized:

```text
src/db/
  schema.ts
  wordItems.ts
  wordFields.ts
  enrichmentJobs.ts
  queryTemplates.ts
  settings.ts
```

Entrypoints should not directly scatter IndexedDB operations.

## Deferred Topics

- Data sync.
- Mobile app.
- Review algorithm.
- Check-ins.
- Word-form normalization and lemmatization.
- Multi-dictionary sources.
- Local MDX dictionary support.
- Dictionary parser failure and fallback strategy.
- Saved-word schema migration.
- Query template import/export.

## Implementation Plan

Implementation is tracked as ordered local issues under `issues/`. The plan favors vertical slices over completing every abstraction up front. Each issue must produce either user-observable behavior or verified reduction of a concrete technical risk.

| Order | Issue | User-observable result | Depends on |
| --- | --- | --- | --- |
| 01 | [Freeze the specification](issues/01-freeze-spec-baseline.md) | One unambiguous MVP contract | Current PRD and ADRs |
| 02 | [Build the local vertical slice](issues/02-build-local-vertical-slice.md) | Select, fake-translate, save, reload, highlight | 01 |
| 03 | [Add real LLM translation](issues/03-add-openai-compatible-translation.md) | Real mixed-field LLM output | 02 |
| 04 | [Add save and enrichment recovery](issues/04-add-save-and-enrichment.md) | Immediate save and restart-safe enrichment | 03 |
| 05 | [Add templates and required settings](issues/05-add-templates-and-settings.md) | User-controlled query behavior | 03, 04 |
| 06 | [Add dictionary adapters](issues/06-add-dictionary-adapters.md) | Dictionary-backed query and enrichment fields | 04, 05 |
| 07 | [Harden page highlighting](issues/07-harden-highlighting.md) | Correct, incremental highlighting on real pages | 02, 04 |
| 08 | [Harden and release the MVP](issues/08-harden-and-release.md) | Reproducible Chrome-ready MVP | 01-07 |

The table is the default critical path. Issue 07 may begin after Issue 04 while Issue 05 or 06 is in progress, but it must not be released independently from the completed save semantics it consumes.

### Issue Sizing Rules

An issue is correctly sized when:

- It has one primary behavior or risk.
- It can be implemented and verified without waiting for another unfinished issue in the same branch.
- It keeps behavior and the tests that prove it together.
- It can be reverted without removing unrelated functionality.
- Its acceptance steps fit in one short manual browser script.

If an issue contains a repository layer, a service layer, several UI surfaces, and multiple providers, split it by user-visible path or provider boundary before implementation.

### Definition Of Done

Every implementation issue must satisfy all of the following before it is closed:

- [ ] Preconditions and acceptance criteria are written before implementation.
- [ ] The smallest failing automated test or reproducible fixture exists.
- [ ] The implementation does not broaden the issue scope.
- [ ] Errors are represented explicitly rather than swallowed.
- [ ] Affected unit and integration tests pass.
- [ ] `pnpm test`, `pnpm typecheck`, and `pnpm build` pass before issue closure.
- [ ] The issue's browser acceptance script passes in unpacked Chrome.
- [ ] Security and privacy effects are recorded when page content, secrets, permissions, or remote requests change.
- [ ] Relevant PRD, CONTEXT, ADR, and issue comments are updated.
- [ ] The change is committed as one coherent GitButler change or a small, ordered stack.

### Engineering Guardrails

- Content scripts own page selection, page-context extraction, isolated UI, and highlighting only.
- The background service worker owns IndexedDB writes, API-key access, external requests, and enrichment scheduling.
- Core contracts must not import WXT, React, Dexie, IndexedDB, or browser APIs.
- Translation-panel output never writes directly into vocabulary fields.
- Service-worker correctness must not depend on module-level mutable state.
- Default automated tests must not depend on live LLM or dictionary networks.
- API keys and full page content must not appear in logs, errors, analytics, or content-script responses.
- DOM scans must be bounded, incremental, and cooperative with the page's main thread.
