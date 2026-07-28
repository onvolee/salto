# Pen workflow

Purpose: implement a Pen frame in the Salto extension while preserving the
frame's visual intent, the repository's architecture, and the extension's
runtime boundaries.

This workflow is for design-to-code work. The Pen frame is the visual and
interaction reference; the repository, `CONTEXT.md`, `apps/extension/DESIGN.md`,
and ADRs are the source of truth for product behavior, technology, and module
boundaries.

## Trigger

Run this workflow when the user writes a command in this form:

```text
/pen-workflow Node ID: <node-id> [optional implementation notes]
```

Example:

```text
/pen-workflow Node ID: bi8Au 在 extension 中实现
```

The node ID is required. Treat the text after the node ID as implementation
scope or constraints, not as a replacement for the frame inspection.

## Non-negotiable rules

1. Read the Pen node and its relevant descendants through the Pencil/Pen MCP
   before writing UI code. Do not guess the frame from the node ID alone.
2. Inspect the repository before choosing files. Do not create a new app,
   framework, state library, CSS system, icon library, or component system for
   one frame.
3. Copy the frame's visual hierarchy, layout intent, content hierarchy, and
   interaction states into the existing stack. Do not copy generated HTML or
   CSS wholesale when it fights the repository's boundaries.
4. Keep entrypoints thin. Put feature behavior in `apps/extension/src/` and
   leave WXT entrypoints responsible for platform wiring and mounting.
5. Keep browser, storage, network, and secret boundaries intact. In
   particular, content scripts do not receive LLM API keys and UI code does
   not write Dexie tables directly.
6. Preserve unrelated work in the working tree. Do not rewrite or delete
   existing user or agent changes.

## Phase 1: read the frame

Use the available Pen MCP tools. If the editor schema is not already known,
load the editor state with schema first. Then:

1. Read the requested node and its descendants with the node inspection tool.
2. Capture a screenshot and layout information for visual comparison.
3. Read referenced variables, styles, and assets when they affect the frame.
4. Identify the frame's intended surface: popup, settings/options page,
   content-script floating UI, or a background/data capability.
5. Record the following before implementation:
   - frame dimensions and viewport assumptions;
   - component hierarchy and repeated elements;
   - typography, spacing, color, border, radius, and elevation intent;
   - visible states such as loading, empty, error, disabled, selected, and
     success;
   - user actions and their expected result;
   - responsive or overflow behavior;
   - images, icons, fonts, or other assets that are actually required.

If the node cannot be read, has no usable descendants, or does not identify a
target surface, stop and report the exact missing context. Do not implement a
fictional version of the frame.

## Phase 2: map the frame to the repository

Read [instructions/stack.md](instructions/stack.md), `CONTEXT.md`,
`apps/extension/DESIGN.md`, the relevant ADRs, and the existing neighboring
implementation before editing.

Choose the smallest existing feature area that owns the behavior:

| Frame surface | Primary implementation area | Boundary |
| --- | --- | --- |
| Popup | `entrypoints/popup/` plus a feature module under `src/` | Popup-only UI and browser tab/settings navigation |
| Settings/options | `src/options/` plus `entrypoints/setting.options/` | Hash-routed settings UI; persistence through services/repositories |
| Selection trigger or translation panel | `src/selection/` | Content-script UI mounted in Shadow DOM |
| Saved-term highlighting | `src/highlighting/` | Page DOM markers and background-provided snapshot |
| Dictionary or LLM capability | `src/dictionary/`, `src/llm/`, or `src/enrichment/` | Background-owned external requests and normalized contracts |
| Persistence or cross-feature orchestration | `src/db/`, `src/repositories/`, or `src/services/` | Background-owned storage and message handling |
| Platform-independent contract or domain rule | `packages/core/src/` | No WXT, React, Dexie, browser APIs, or IndexedDB shapes |
| Reusable primitive | `src/components/ui/` only when it is genuinely shared | Use the existing shadcn/Base UI patterns |

For a new feature module, prefer a focused directory such as
`src/options/<feature>/`, `src/selection/<feature>/`, or
`src/<capability>/`. Keep the following roles separate:

- React components render and emit user intent.
- Hooks coordinate view state and subscriptions.
- Pure functions hold layout, parsing, formatting, and state-transition rules.
- Services coordinate background use cases and message contracts.
- Repositories own persistence access behind a small interface.
- Adapters translate external providers into normalized contracts.
- `packages/core` owns platform-neutral types, schemas, and domain logic.

Before editing, write a short frame-to-repository map in the working notes or
implementation plan:

```text
Pen node: <node-id>
Surface: <popup | options | content | background capability>
Existing owner: <directory/component>
New modules: <files and responsibilities>
State/data flow: <user action -> message/service -> result -> UI state>
Unresolved design decisions: <questions or explicit assumptions>
```

If the frame conflicts with an existing product decision or ADR, stop and
surface the conflict. Do not silently change the product contract to match a
visual mockup.

## Phase 3: implement

1. Reuse existing UI primitives, semantic theme variables, typography, icon
   library, and utility helpers. The extension's visual system is documented in
   `apps/extension/DESIGN.md`; adapt Pen values to those tokens where the
   frame does not introduce a deliberate product decision.
2. Build the smallest vertical slice that makes the frame real: render the
   structure, wire the primary interaction, then add loading/empty/error and
   persistence states required by the behavior.
3. Use stable dimensions for fixed-format surfaces and viewport-aware
   constraints for popup, panel, dialog, and list layouts. Do not let labels,
   icons, loading text, or error text shift the core geometry unexpectedly.
4. Use accessible semantic HTML and keyboard behavior. Every interactive
   control needs an accessible name, visible focus state, disabled/loading
   treatment where applicable, and a truthful result.
5. Use `@dnd-kit/core` and `@dnd-kit/sortable` for reorderable lists. Use
   existing shadcn/Base UI primitives for dialogs, tabs, fields, switches,
   selects, and similar controls.
6. Use `@tanstack/react-form` and `zod` for non-trivial forms. Keep trivial
   forms simple when the existing code does so consistently.
7. Keep content-script UI inside the existing Shadow DOM mount. Keep saved-word
   highlighting as page DOM behavior separate from extension-owned controls.
8. Route persistence, dictionary/LLM calls, enrichment, and API-key access
   through the background boundary. A new UI component must not import Dexie
   tables or call an external provider directly.
9. Add or update focused tests for behavior and state transitions. Prefer pure
   unit tests for layout/state logic and component tests for user-visible
   interaction; do not replace meaningful behavior tests with snapshots alone.

When Pen shows an interaction that the current product contract does not
support, implement the closest truthful behavior only when it is local and
reversible, and record the deviation. For a behavior that changes data shape,
security, persistence, or a product decision, stop for clarification or
propose an ADR instead.

## Phase 4: verify

Run the narrowest relevant checks first, then the extension checks:

```bash
pnpm --filter @salto/extension test
pnpm --filter @salto/extension typecheck
pnpm --filter @salto/extension build
```

For a UI frame, also run the extension dev server and inspect the actual target
surface in a browser at the intended viewport. Compare it with the Pen
screenshot for hierarchy, alignment, overflow, typography, focus, and state
transitions. For content-script work, use the local fixture or a controlled
page and verify Shadow DOM isolation. For options work, verify hash navigation,
history behavior, reload behavior, and persistence through the background
path.

Do not treat a successful TypeScript build as visual verification. If browser
verification is unavailable, report that explicitly and still run the relevant
automated checks.

## Completion report

Report:

- Pen node ID and resolved target surface;
- frame-to-repository mapping and files changed;
- user-visible behavior implemented;
- intentional deviations from the frame and why;
- tests, typecheck, build, and browser verification results;
- remaining assumptions or blockers.

Do not commit, push, or open a pull request unless the user separately asks
for that workflow.
