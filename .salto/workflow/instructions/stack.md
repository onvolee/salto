# Extension Stack Instruction

Purpose: give design-to-code and implementation agents the current Salto
extension stack, directory ownership, and dependency rules.

This is a repository-specific instruction. The versions below mirror the
current `package.json` files; for a caret range, the listed version is the
declared baseline. When dependencies change, update this document with the
package change rather than treating the list as an independent source of truth.

## Workspace

| Layer | Choice | Location / rule |
| --- | --- | --- |
| Package manager | pnpm `11.15.0` | Lightweight workspace defined by `pnpm-workspace.yaml` |
| Workspace apps | `apps/*` | Browser extension currently lives in `apps/extension` |
| Workspace packages | `packages/*` | Platform-neutral contracts currently live in `packages/core` |
| Module format | ESM | Root and workspace packages use `"type": "module"` |
| Language | TypeScript `7.0.2` | Strict typed code; no generated code edits |

## Runtime and build

| Concern | Choice | Use |
| --- | --- | --- |
| Extension framework | WXT `0.20.27` | Manifest, entrypoints, build, and browser API boundary |
| WXT React module | `@wxt-dev/module-react` `1.2.2` | React entrypoint integration |
| Target browser | Chrome and Chromium first | Keep browser APIs behind WXT or small adapters |
| Bundler integration | Vite through WXT | Tailwind Vite plugin is configured in `wxt.config.ts` |
| Type generation | `wxt prepare` | Run through the extension test/typecheck scripts |

WXT-owned generated directories such as `.wxt/` and `.output/` are build
artifacts. Do not hand-edit them or use them as feature implementation
locations.

## UI stack

| Concern | Choice | Use |
| --- | --- | --- |
| UI runtime | React `19.2.7` + `react-dom` `19.2.7` | Popup, options, and content-script UI |
| CSS framework | Tailwind CSS `4.3.2` | Utility styling through each entrypoint's CSS |
| Tailwind Vite plugin | `@tailwindcss/vite` `4.3.2` | Configured by `apps/extension/wxt.config.ts` |
| Component primitives | shadcn `4.13.0` + `@base-ui/react` `1.6.0` | Existing components under `src/components/ui/` |
| Class utilities | `clsx` `2.1.1` + `tailwind-merge` `3.6.0` | Use `src/lib/utils.ts` and `cn()` |
| Icons | Hugeicons `@hugeicons/react` `1.1.9` and `@hugeicons/core-free-icons` `4.2.2` | Use existing icon library; do not add another icon set |
| Font | `@fontsource-variable/inter` `5.2.8` | Existing entrypoint CSS imports; use the documented system/Inter style |
| Theme | `src/theme/linear-theme.css` | Semantic Salto variables and light/dark mode |

The visual contract is in `apps/extension/DESIGN.md`. Keep the compact
productivity-tool character: no decorative gradients, no oversized marketing
layout, no unbounded rounded cards, and no new color system for one frame.
Prefer semantic variables such as `--salto-surface`, `--salto-foreground`,
`--salto-border`, `--salto-primary`, and `--salto-ring` over hard-coded colors.

The shadcn configuration uses `base-mira`, CSS variables, TSX, and Hugeicons.
Existing primitives are the default for buttons, fields, dialogs, tabs,
switches, selects, alerts, separators, scroll areas, and similar controls.

## Forms, ordering, and data validation

| Concern | Choice | Use |
| --- | --- | --- |
| Forms | `@tanstack/react-form` `1.33.2` | Non-trivial options/settings forms |
| Schema validation | `zod` `4.4.3` | Shared or feature validation schemas |
| Drag and drop | `@dnd-kit/core` `6.3.1` + `@dnd-kit/sortable` `10.0.0` | Accessible sortable/reorderable lists |

Use local state for a genuinely trivial form when that matches existing code.
Do not introduce a new form or drag-and-drop abstraction for a single frame.

## Data, requests, and storage

| Concern | Choice | Ownership |
| --- | --- | --- |
| Core contracts | `@salto/core` workspace package | Types, schemas, messages, domain rules, normalized provider contracts |
| IndexedDB adapter | Dexie `4.4.4` | Schema/table definitions in `src/db/`; access through repositories and background orchestration |
| HTTP | `ofetch` `1.5.1` | Dictionary adapters and future HTTP clients; keep provider mapping in adapters |
| LLM client | `ai` `7.0.30` + `@ai-sdk/openai-compatible` `3.0.11` | Background-owned OpenAI-compatible request paths |
| Extension settings | Existing settings repository/service path; WXT/browser storage only where the platform or migration requires it | Extension-local settings, never syncable vocabulary records |

The background service worker is the extension's data and request boundary:

- `entrypoints/background.ts` wires services and browser events.
- `src/services/` owns cross-feature use cases and runtime message handling.
- `src/repositories/` owns persistence-facing interfaces and local adapters.
- `src/db/` owns Dexie database schema, tables, indexes, migrations, and
  transactions.
- `src/dictionary/` owns dictionary HTTP/query adapters and normalization.
- `src/llm/` owns LLM client and query execution.
- `src/enrichment/` owns asynchronous vocabulary field enrichment and retry
  scheduling.

Content scripts and options/popup UI request these capabilities through typed
message/service boundaries. LLM API keys are extension-local secrets and must
remain in background-owned request paths; never pass them to content scripts or
render them into UI state.

## Entrypoints and feature modules

| Area | Entrypoint | Feature modules |
| --- | --- | --- |
| Background | `entrypoints/background.ts` | `src/services`, `src/repositories`, `src/db`, `src/dictionary`, `src/llm`, `src/enrichment` |
| Content script | `entrypoints/content.tsx` | `src/selection` and `src/highlighting` |
| Popup | `entrypoints/popup/main.tsx` | Popup-specific React components under `src/` when the surface grows |
| Options/settings | `entrypoints/setting.options/main.tsx` | `src/options` and `src/query-template` |

Entrypoints should mainly import CSS, create/mount React roots, construct WXT
or browser adapters, and connect feature modules. They should not become the
home for domain rules, large JSX trees, persistence calls, or provider logic.

Recommended ownership inside a feature:

```text
src/<feature>/
  components/     React presentation for the feature
  hooks/          subscriptions and view coordination
  *.ts            pure rules, state transitions, parsing, or adapters
  *.test.*        focused behavior tests next to the behavior
```

Use this shape only when the feature warrants it; do not create empty layers.
Small existing modules may remain flat.

## Dependency direction

The allowed direction is:

```text
entrypoints -> feature modules -> services/repositories/adapters
                         -> @salto/core
services -> repositories -> db (Dexie)
services -> dictionary/llm/enrichment
```

`packages/core` is platform-neutral. It must not import WXT, React, Dexie,
browser extension APIs, `indexedDB`, DOM-only types, or extension-specific
table shapes. Extension adapters may depend on core contracts, not the reverse.

Keep visual components independent from storage implementation. A component
may call a hook or typed client; it should not instantiate `SaltoDatabase`,
import a Dexie table, or know an IndexedDB transaction shape.

## Testing and verification

| Concern | Choice | Command / rule |
| --- | --- | --- |
| Test runner | Vitest `4.1.10` | `pnpm --filter @salto/extension test` |
| React testing | `@testing-library/react` `16.3.2` + user-event `14.6.1` | Test user-visible behavior and state transitions |
| DOM environment | `happy-dom` `20.10.6` | Use when a component needs DOM behavior; current default is Node |
| IndexedDB tests | `fake-indexeddb` `6.2.5` | Use for repository/database behavior |
| Type verification | TypeScript | `pnpm --filter @salto/extension typecheck` |
| Build verification | WXT | `pnpm --filter @salto/extension build` |

For UI work, automated checks are necessary but not sufficient: verify the
actual extension surface at the frame's intended viewport, including focus,
overflow, loading/error states, and dark/system theme when relevant.

## Forbidden defaults

Do not:

- add a second frontend framework, CSS framework, state manager, icon set, or
  component library for one frame;
- put feature logic in WXT-generated files or large entrypoint files;
- import Dexie tables, `browser.*`, or DOM APIs into `packages/core`;
- call dictionary/LLM providers directly from React components or content UI;
- expose API keys to content scripts or persist them in ordinary UI state;
- bypass repositories/services with direct IndexedDB writes;
- duplicate an existing shadcn primitive or theme token under a new name;
- use hard-coded visual values when an existing Salto token expresses the same
  intent;
- treat a screenshot or snapshot test as proof that the interaction works;
- modify `node_modules/`, `.wxt/`, or `.output/` by hand.

When a Pen frame requires a new dependency or a boundary change, stop and
explain the tradeoff. Add the dependency or revise the architecture only with
explicit scope and, when the decision is durable, an ADR.
