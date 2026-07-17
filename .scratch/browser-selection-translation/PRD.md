# Browser Selection Translation MVP PRD

Status: ready-for-agent

## Summary

Build Salto MVP v0.1 as a Chrome/Chromium browser extension for reading-time
translation, saved-vocabulary collection, and generation of meaning-recall card
records.

The user selects an English word or short phrase, intentionally opens a nearby
translation panel, reads configurable LLM or dictionary output, and saves useful
vocabulary without leaving the page. Saving persists sync-ready vocabulary data
immediately; extension-local background jobs enrich fixed vocabulary fields and
generate a meaning-recall card after the term and meaning are ready.

## Goals

- Help users understand selected English words or short phrases while reading.
- Support configurable, ordered selection-translation output.
- Allow LLM and dictionary fields to be mixed in one query template.
- Save vocabulary without waiting for a provider request.
- Enrich fixed vocabulary fields asynchronously and retry failures per field.
- Highlight saved vocabulary on initial and dynamically added page content.
- Keep MVP data local while preserving sync-ready vocabulary and learning records.

## Non-Goals

- Mobile app, accounts, cloud sync, or sync APIs.
- Scheduler, review algorithm, review UI, check-ins, or review actions.
- Lemmatization, stemming, word-form matching, or cross-node phrase matching.
- Multi-dictionary aggregation or automatic provider fallback.
- Bundled offline dictionary data.
- Saved-vocabulary field customization or editing.
- Import or export.

## User Flow

1. User selects an English word or short phrase of at most 500 characters.
2. Extension shows a floating trigger near the selection without querying a provider.
3. User clicks the trigger or presses the registered keyboard shortcut.
4. Extension opens a floating translation panel near the selection.
5. Extension executes the active query template.
6. Enabled LLM fields are grouped into one LLM request.
7. Enabled dictionary fields are grouped into one lookup for the active adapter.
8. Per-field successes and failures are rendered in schema order.
9. User invokes the save action for the selection.
10. Extension creates or reuses a `VocabularyItem`, stores its fixed fields and a
    deduplicated `VocabularyContext`, then returns saved state after the local
    transaction commits.
11. Extension-local `EnrichmentJob` records fill pending vocabulary fields in the
    background; translation-panel results are never copied into those fields.
12. Saved terms are highlighted on pages, and one meaning-recall `LearningCard` is
    generated after both the term and meaning fields are ready.

## Selection Translation

Selection support:

- English words and short phrases.
- Non-empty after trimming.
- At most 500 UTF-16 code units before normalization.

Selection alone must not extract full page content, send a background translation
message, request host permission, or contact a provider. Provider work starts only
after the user activates the floating trigger or shortcut.

The translation panel:

- Anchors near the selection and flips at viewport edges.
- Shows the active query-template name and supports template switching.
- Displays fields in schema order with independent loading, ready, unavailable,
  and failed states.
- Includes save and refresh/regenerate actions.
- Ignores stale results after close or regeneration.
- Closes on outside click or `Esc` and remains reachable on narrow viewports.

## Query Template Contract

Query templates are extension-local configuration. They do not define syncable
vocabulary fields.

Users can create, copy, and delete user templates; edit labels and sources; edit
LLM types and instructions; choose a normalized dictionary field; enable and
reorder fields; and choose one default template. At least one immutable system
template always remains available.

```ts
type QuerySchemaFieldType = "text" | "list"
type QuerySchemaFieldSource = "llm" | "dictionary"
type DictionaryQueryField =
  | "phonetic"
  | "partOfSpeech"
  | "meaning"
  | "synonyms"
  | "wordForms"

type DictionaryQueryFieldSpec = {
  phonetic: "text"
  partOfSpeech: "text"
  meaning: "text"
  synonyms: "list"
  wordForms: "list"
}

type QueryTemplate = {
  id: string
  name: string
  fields: readonly QuerySchemaField[]
  createdAt: string
  updatedAt: string
}

type QuerySchemaFieldBase = {
  id: string
  label: string
  order: number
  enabled: boolean
}

type LlmQuerySchemaField = QuerySchemaFieldBase & {
  source: "llm"
  type: QuerySchemaFieldType
  instruction: string
  dictionaryField?: never
}

type DictionaryQuerySchemaField = {
  [K in DictionaryQueryField]: QuerySchemaFieldBase & {
    source: "dictionary"
    dictionaryField: K
    type: DictionaryQueryFieldSpec[K]
    instruction?: never
  }
}[DictionaryQueryField]

type QuerySchemaField = LlmQuerySchemaField | DictionaryQuerySchemaField
```

`text` fields return one string. `list` fields return `readonly string[]`; markdown
is not a field type in MVP. A dictionary adapter is selected by extension settings,
so provider IDs do not appear in `QuerySchemaFieldSource`. A dictionary field maps
through `dictionaryField`; its type is derived from `DictionaryQueryFieldSpec` and
cannot be edited independently. Switching a field source requires a valid LLM
instruction or dictionary-field selection before the template can be saved.

Per-field execution returns this discriminated result:

```ts
type QueryFieldResult =
  | {
      fieldId: string
      status: "ready"
      type: "text"
      value: string
    }
  | {
      fieldId: string
      status: "ready"
      type: "list"
      value: readonly string[]
    }
  | {
      fieldId: string
      status: "unavailable"
      reason: "not-configured" | "not-found" | "unsupported" | "missing"
    }
  | {
      fieldId: string
      status: "failed"
      error: {
        code: string
        message: string
      }
    }
```

The background boundary validates field IDs and success values against the active
template. A missing configuration or an expected value the lookup cannot supply is
`unavailable`; malformed, extra, or type-mismatched provider output is `failed`.
Neither state discards successful siblings.

Execution rules:

- Merge all enabled LLM fields into one LLM request per run.
- Merge all enabled dictionary fields into one lookup per adapter and run.
- Preserve original schema order when mapping results.
- Treat disabled fields as absent, not failed.
- Never use translation results as vocabulary-field values.

## Prompt Context Contract

LLM instructions support exactly these public template variables:

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

| Variable | Value |
| --- | --- |
| `{{selection}}` | Exact selected text after outer whitespace is trimmed |
| `{{sentence}}` | Sentence containing the selection, or `""` when unavailable |
| `{{paragraphs}}` | Nearby paragraph text, or `""` when unavailable |
| `{{targetLanguage}}` | Configured target translation language |
| `{{webTitle}}` | Current page title, or `""` when unavailable |
| `{{webUrl}}` | Current page URL without credentials or fragment |
| `{{webContent}}` | Extracted page body text, whitespace-normalized and truncated to 2000 UTF-16 code units |

All properties are required strings so template rendering has one shape across
content, messaging, and core contracts. Missing extractable context becomes an
empty string; it is distinct from an unknown variable. Unknown variables produce a
warning when a template is saved but do not block saving. Runtime rendering leaves
an explicit field diagnostic rather than silently substituting an invented value.

The content script may construct `PromptContext`, but only after explicit
translation intent. It sends the typed context to a specific translation message;
there is no generic background fetch message.

## LLM Configuration And Host Permission

MVP supports one active OpenAI-compatible configuration:

```ts
type LlmPublicConfig = {
  provider: "openai-compatible"
  baseUrl: string
  model: string
  temperature?: number
}

type LlmSecret = {
  apiKey: string
}
```

Public configuration and the API-key secret are stored and read separately. The
options UI can replace a saved key but cannot read it back. Content scripts never
receive, cache, display, or log the key.

The manifest declares `https://*/*` and `http://*/*` as optional capabilities for
dynamically discovered API hosts under `optional_host_permissions` rather than
required `host_permissions`. HTTPS and HTTP origins are allowed. URLs containing
credentials or a scheme other than HTTP(S) are rejected.

When the user clicks Save configuration or Test connection, the options page:

1. Normalizes `baseUrl` with the URL parser and derives its origin.
2. Requests only `<origin>/*` through `permissions.request` in that user gesture;
   URL paths are not treated as a narrower permission boundary than the origin.
3. Persists the configuration only after permission is granted.
4. Treats denial as a visible, recoverable state and sends no request.
5. Removes an obsolete origin grant after replacement when no active provider uses
   it, subject to explicit user confirmation in the same settings workflow.

The background service worker permits requests only to the currently configured
and granted origin and the OpenAI-compatible request path. It cannot be used as an
arbitrary URL proxy.

## Dictionary Adapter Rollout

MVP targets lightweight `youdao-web` and `cambridge-web` adapters behind one
normalized `DictionaryClient` boundary, but rollout is sequential:

1. Select the first adapter based on current access reliability and required-field
   coverage.
2. Complete fixtures, parser, permissions, query mapping, enrichment mapping, and
   browser acceptance for that adapter.
3. Record observed failure modes.
4. Begin the second adapter only after the first satisfies Phase 06 exit criteria.

There is no aggregation or automatic fallback. The active adapter is explicit.
Provider URL, HTML, request signing, cookies, anti-abuse behavior, and parser errors
remain extension-local and never enter vocabulary contracts. Default tests make no
live provider requests.

## Saved Vocabulary Behavior

Saving and selection translation are separate workflows. Saving must not reuse a
translation-panel result.

The save transaction:

- Creates or reuses one `VocabularyItem` by unique canonical key.
- Creates the ready system `term` field and any missing fixed fields.
- Adds a deterministic `VocabularyContext` only when its deduplication tuple is new.
- Creates extension-local jobs for fields that require remote enrichment.
- Commits item, fields, context, and jobs atomically in IndexedDB.
- Returns `saved` or `already-saved` immediately after local commit.

Field statuses and retry state are tracked independently. Item-level display state
is derived from field states rather than persisted as a second source of truth.

### English Canonical Key

MVP supports the source language key `en`. Canonicalization is deterministic:

1. Reject a selection longer than 500 UTF-16 code units.
2. Apply Unicode NFKC normalization.
3. Trim outer Unicode whitespace and replace every internal run of Unicode
   whitespace with one ASCII space.
4. Reject the normalized result when it is empty.
5. Lowercase with the fixed `en-US` locale.
6. Prefix the normalized term with `en:`.

Do not lemmatize, stem, remove accents, strip punctuation, rewrite apostrophes or
hyphens, or singularize. Therefore `Running` and `running` share `en:running`, while
`run` and `running`, `don't` and `dont`, and `ice cream` and `ice-cream` remain
different keys. `VocabularyItem.term` stores the NFKC/whitespace-normalized term
with the user's casing preserved.

### Vocabulary Context Deduplication

A context identity uses exactly:

1. `vocabularyItemId`.
2. Normalized page URL.
3. Normalized sentence context.

Normalize an HTTP(S) page URL with the URL parser, clear username and password,
lowercase scheme and host, remove default ports and the fragment, and preserve
path, trailing slash, query, and query-parameter order. Normalize sentence context with NFKC, outer trimming,
and internal whitespace collapse while preserving case and punctuation. An
unavailable sentence is `""`. The deterministic context ID is derived from the
three normalized components, so an identical tuple returns the existing context
without overwriting it and any changed component creates a distinct context.
Changes only to paragraph text or page title do not create or update a context.

## Fixed Vocabulary Schema

The saved-vocabulary schema is system-owned. Users cannot add, delete, hide,
reorder, redefine, edit, or change the source of these fields in MVP.

```ts
type VocabularyFieldKey =
  | "term"
  | "phonetic"
  | "partOfSpeech"
  | "meaning"
  | "examples"
  | "synonyms"
  | "wordForms"

type VocabularyFieldValue = string | readonly string[]
type VocabularyFieldValueType = "text" | "list"
type VocabularyFieldSource = "system" | "dictionary" | "llm"

type VocabularyFieldSpec = {
  term: { value: string; source: "system" }
  phonetic: { value: string; source: "dictionary" }
  partOfSpeech: { value: string; source: "dictionary" }
  meaning: { value: string; source: "dictionary" }
  examples: { value: readonly string[]; source: "llm" }
  synonyms: { value: readonly string[]; source: "dictionary" }
  wordForms: { value: readonly string[]; source: "dictionary" }
}
```

| Key | Display label | Value type | Source | Value rule |
| --- | --- | --- | --- | --- |
| `term` | 词条 | `text` | `system` | Normalized saved surface term |
| `phonetic` | 音标 | `text` | `dictionary` | One display-ready phonetic string |
| `partOfSpeech` | 词性 | `text` | `dictionary` | One display-ready part-of-speech string |
| `meaning` | 释义 | `text` | `dictionary` | One display-ready meaning string |
| `examples` | 例句 | `list` | `llm` | Ordered example sentences |
| `synonyms` | 近义词 | `list` | `dictionary` | Ordered synonym terms |
| `wordForms` | 词形变化 | `list` | `dictionary` | Ordered word-form strings |

The schema determines the valid runtime shape. A ready `text` field contains a
string; a ready `list` field contains `readonly string[]`. Pending and failed fields
have no value. Empty provider output is unavailable or failed according to the
adapter result and is never coerced into the wrong shape.

## Local Data And Ownership Model

Domain contracts stay storage-adapter neutral. IndexedDB/Dexie tables use record
IDs as foreign keys and must not replace domain relationships with canonical keys.

```ts
type SyncMetadata = {
  createdAt: string
  updatedAt: string
  recordVersion: number
  deletedAt?: string
}

type VocabularyItem = {
  id: string
  canonicalKey: string
  term: string
  language: "en"
  sync: SyncMetadata
}

type VocabularyFieldBase<K extends VocabularyFieldKey> = {
  id: string
  vocabularyItemId: string
  key: K
  source: VocabularyFieldSpec[K]["source"]
  sync: SyncMetadata
}

type VocabularyFieldFor<K extends VocabularyFieldKey> =
  | (VocabularyFieldBase<K> & {
      status: "pending"
      value?: never
      errorMessage?: never
    })
  | (VocabularyFieldBase<K> & {
      status: "ready"
      value: VocabularyFieldSpec[K]["value"]
      errorMessage?: never
    })
  | (VocabularyFieldBase<K> & {
      status: "failed"
      value?: never
      errorMessage: string
    })

type VocabularyField = {
  [K in VocabularyFieldKey]: VocabularyFieldFor<K>
}[VocabularyFieldKey]

type VocabularyContext = {
  id: string
  vocabularyItemId: string
  sentence: string
  paragraphs: string
  pageTitle: string
  pageUrl: string
  savedAt: string
  sync: SyncMetadata
}

type LearningCard = {
  id: string
  vocabularyItemId: string
  cardType: "meaning-recall"
  frontFieldKeys: readonly ["term"]
  backFieldKeys: readonly ["meaning"]
  sync: SyncMetadata
}

type RemoteVocabularyFieldKey = Exclude<VocabularyFieldKey, "term">

type EnrichmentJobFor<K extends RemoteVocabularyFieldKey> = {
  id: string
  vocabularyItemId: string
  fieldKey: K
  source: VocabularyFieldSpec[K]["source"]
  status: "queued" | "running" | "succeeded" | "failed"
  attempts: number
  nextRunAt: string
  lastError?: string
}

type EnrichmentJob = {
  [K in RemoteVocabularyFieldKey]: EnrichmentJobFor<K>
}[RemoteVocabularyFieldKey]
```

`VocabularyField`, `VocabularyContext`, and `LearningCard` use deterministic IDs
when their natural identities are stable. `EnrichmentJob` is not syncable and has
no `SyncMetadata`. Learning-card generation is idempotent and happens only when
both term and meaning are ready. `LearningState` and `ReviewLog` remain part of the
future syncable learning model but are not created until review behavior exists.

`recordVersion` starts at `1` and increments once for each committed semantic
change to that syncable record. An idempotent command that leaves the record
unchanged does not increment it. `createdAt` remains fixed; `updatedAt` changes in
the same commit as `recordVersion`.

| Record or configuration | MVP storage owner | Future sync |
| --- | --- | --- |
| `VocabularyItem` | IndexedDB through background repository | Yes |
| `VocabularyField` | IndexedDB through background repository | Yes |
| `VocabularyContext` | IndexedDB through background repository | Yes |
| `LearningCard` | IndexedDB through background learning repository | Yes |
| `LearningState`, `ReviewLog` | Not created by this MVP slice | Yes when review exists |
| `EnrichmentJob` | IndexedDB extension queue | No |
| Query templates and active-template selection | Extension settings/repository | No |
| LLM public config and API-key secret | Separate extension-local settings | No |
| Dictionary adapter selection and permissions | Extension settings/browser permission store | No |
| Highlight, theme, and UI state | Extension settings | No |

Recommended storage constraints and indexes:

- `vocabulary_items`: primary key `id`; unique `canonicalKey`; indexes for
  `language` and `sync.updatedAt`.
- `vocabulary_fields`: primary key `id`; unique pair `vocabularyItemId + key`;
  indexes for `vocabularyItemId`, `key`, and `status`.
- `vocabulary_contexts`: primary key `id`; indexes for `vocabularyItemId` and
  `pageUrl`.
- `learning_cards`: primary key `id`; unique pair `vocabularyItemId + cardType`.
- `enrichment_jobs`: primary key `id`; indexes for `status + nextRunAt`,
  `vocabularyItemId`, and `fieldKey`.

## Minimum Extension Settings And Defaults

```ts
type ExtensionSettings = {
  activeQueryTemplateId: string
  targetLanguage: string
  highlightEnabled: boolean
  themeMode: "system" | "light" | "dark"
  activeDictionaryProvider?: "youdao-web" | "cambridge-web"
}

const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  activeQueryTemplateId: "system-default",
  targetLanguage: "zh-CN",
  highlightEnabled: true,
  themeMode: "system",
}

const DEFAULT_QUERY_TEMPLATE: QueryTemplate = {
  id: "system-default",
  name: "Default",
  createdAt: "<seed-time>",
  updatedAt: "<seed-time>",
  fields: [
    {
      id: "system-default:translation",
      label: "Translation",
      source: "llm",
      type: "text",
      instruction:
        "Translate {{selection}} into {{targetLanguage}}. " +
        "Use {{sentence}} only when needed for disambiguation. " +
        "Return only the translation.",
      order: 0,
      enabled: true,
    },
    {
      id: "system-default:key-points",
      label: "Key points",
      source: "llm",
      type: "list",
      instruction:
        "List the key meanings or usage notes for {{selection}} in " +
        "{{sentence}}. Write each item in {{targetLanguage}}.",
      order: 1,
      enabled: true,
    },
  ],
}
```

`<seed-time>` is the installation/recovery timestamp supplied by the injected
clock; it is not part of template identity. The system template ID and field IDs
are stable, and idempotent recovery reuses them. LLM configuration and its secret
are absent until the user saves a permission-granted configuration.

| Phase | Required settings |
| --- | --- |
| 02 | Seeded active template ID, target language, highlight enabled, existing theme mode |
| 03 | Separate `LlmPublicConfig`, write-only API-key secret, and exact-origin permission |
| 04 | No new mutable user setting; retry/backoff and fixed field schema are system policy |
| 05 | UI for the settings above and template management |
| 06 | Active dictionary adapter after the first adapter reaches acceptance |

There are no saved-vocabulary field settings. An informational read-only schema
view is optional and cannot block Phase 05. UI-language expansion, theme-color
customization, multiple LLM profiles, per-template models, and provider fallback
are deferred.

## Highlighting

MVP highlighting is case-insensitive for English, matches full word boundaries,
does not lemmatize or cross DOM text nodes, and prefers the longest valid term when
saved phrases overlap words in one text node. It skips extension-owned, interactive,
editable, code, hidden, and already-highlighted regions. Initial scanning is
followed by bounded incremental scanning for DOM changes. Disabling highlighting
restores the original text without replacing host `innerHTML`.

The visible treatment is a wavy underline. Saved state and failures elsewhere in
the UI must not rely on color alone.

## External Requests, Privacy, And Secrets

Every external request originates in the background service worker through a typed
LLM or dictionary adapter:

| Trigger | Remote data | Destination |
| --- | --- | --- |
| Explicit translation trigger/shortcut | Rendered enabled-field prompts; only referenced `PromptContext` values, which may include selection, sentence, paragraphs, target language, title, URL, and up to 2000 characters of page content | Configured and permission-granted LLM origin |
| Explicit translation trigger/shortcut | Selected normalized term only | Active dictionary origin |
| Authorized saved-vocabulary enrichment job | Saved term and only the sentence/paragraph context required by the fixed LLM enrichment prompt | Configured and permission-granted LLM origin |
| Authorized saved-vocabulary enrichment job | Saved normalized term only | Active dictionary origin |

Selection by itself sends nothing remotely. Saving authorizes the listed background
enrichment work; automatic retries remain limited to persisted authorized jobs.
Page content is transient, bounded before messaging and again before request
construction, and is not stored in logs, errors, analytics, jobs, or translation
caches. `VocabularyContext` stores the explicitly listed reading context locally.

API keys remain extension-local, are read only by background-owned LLM request
paths, use authorization headers only for the configured origin, and never appear
in messages, responses, logs, errors, analytics, fixtures, or packaged source.
User-facing privacy copy must state which context variables a template references
before or alongside provider configuration.

## Technical Baseline

- WXT.js extension under `apps/extension`.
- React at extension UI entrypoint edges.
- TypeScript 7.x and storage-neutral contracts under `packages/core`.
- IndexedDB through Dexie repositories owned by the background boundary.
- Vitest with no live provider requests in default suites.

`entrypoints/background.ts` owns persistent writes, external requests, permission-
checked adapter execution, enrichment scheduling, and API-key access.
`entrypoints/content.ts` owns selection, page-context extraction, the panel host,
highlighting, and typed messages. `entrypoints/options/` owns template and extension
configuration through services/messages, not direct Dexie table access.

Core contracts must not import WXT, React, Dexie, IndexedDB, or browser APIs.
Service-worker correctness must not depend on module-level mutable state.

## Implementation Plan And Traceability

| Order | Issue | User-observable result | Depends on |
| --- | --- | --- | --- |
| 01 | [Freeze the specification](issues/01-freeze-spec-baseline.md) | One unambiguous MVP contract | Current PRD and ADRs |
| 02 | [Build the local vertical slice](issues/02-build-local-vertical-slice.md) | Select, fake-translate, save, reload, highlight | 01 |
| 03 | [Add OpenAI-compatible translation](issues/03-add-openai-compatible-translation.md) | Real mixed-field LLM output | 02 |
| 04 | [Add save and restart-safe enrichment](issues/04-add-save-and-enrichment.md) | Immediate save, durable enrichment, card generation | 03 |
| 05 | [Add query templates and required settings](issues/05-add-templates-and-settings.md) | User-controlled query behavior | 03, 04 |
| 06 | [Add dictionary adapters](issues/06-add-dictionary-adapters.md) | Accepted dictionary query and enrichment | 04, 05 |
| 07 | [Harden saved-vocabulary highlighting](issues/07-harden-highlighting.md) | Correct incremental highlighting | 02, 04 |
| 08 | [Harden and release the MVP](issues/08-harden-and-release.md) | Reproducible Chrome-ready MVP | 01-07 |

User-flow trace:

| User-flow steps | Planned issues |
| --- | --- |
| 1-4: selection, trigger/shortcut, panel | 02; keyboard shortcut release proof in 08 |
| 5-8: template execution and ordered results | 02 fake path, 03 LLM, 05 templates, 06 dictionary |
| 9-10: immediate idempotent save and context | 02 proof, 04 production behavior |
| 11: restart-safe field enrichment | 04, with dictionary adapter in 06 |
| 12: highlighting and meaning-recall card | 04 card generation, 07 highlighting, 08 golden path |

Every implementation issue is numbered, has `ready-for-agent` triage status,
acceptance criteria, verification, exit criteria, and a rollback boundary. Issue 07
may start after Issue 04 while Issue 05 or 06 is in progress, but release still
depends on the full ordered plan.

## Deferred Topics

- Accounts, cloud sync, sync APIs, and mobile clients.
- `LearningState`, `ReviewLog`, scheduler, review algorithm, and review UI.
- UI-language expansion and new appearance customization.
- Lemmatization, stemming, cross-node phrase matching, and multi-dictionary lookup.
- Local MDX, provider fallback, and dictionary aggregation.
- Saved-vocabulary editing, notes, schema customization, and management dashboard.
- Import/export and query-template import/export.

## Open Non-Blocking Questions

| Question | Owner | Why it does not block the vertical slice |
| --- | --- | --- |
| Which adapter is implemented first? | Phase 06 implementer, confirmed during Phase 06 preconditions | Phases 02-05 use a provider-neutral contract and deterministic fakes |
| Does Phase 05 include a read-only vocabulary-schema view? | Phase 05 product owner | It exposes no control and is optional for acceptance |
| Does the second dictionary adapter meet the same release or a follow-up release? | Phase 06 product owner after first-adapter evidence | The first accepted adapter satisfies the MVP provider path |

## Definition Of Done

Every implementation issue must satisfy all of the following before closure:

- [ ] Preconditions and acceptance criteria are written before implementation.
- [ ] Tests are written at agreed public seams and fail before the behavior exists.
- [ ] Implementation does not broaden the issue scope.
- [ ] Errors are explicit, stable, and do not expose secrets or page content.
- [ ] Affected unit and integration tests pass during implementation.
- [ ] `pnpm test`, `pnpm typecheck`, and `pnpm build` pass before issue closure.
- [ ] The issue's browser acceptance script passes in unpacked Chrome.
- [ ] Security and privacy effects are recorded when content, secrets, permissions,
  or remote requests change.
- [ ] Relevant PRD, CONTEXT, ADR, and issue comments are updated.
- [ ] The change is committed as one coherent GitButler change or a small ordered stack.

## Engineering Guardrails

- Content scripts own page interaction and typed calls into the background only.
- Background owns IndexedDB writes, secrets, external requests, and jobs.
- Query templates and vocabulary fields remain separate models.
- Provider-specific behavior remains behind adapters.
- API keys and full page content never appear in logs, errors, analytics, fixtures,
  content-script responses, or packaged development artifacts.
- DOM scans remain bounded, incremental, and cooperative with the page main thread.
- Database rollback never clears user data; schema changes use forward migrations.
