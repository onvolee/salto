# OpenDesign HTML Implementation Workflow

Purpose: give agents a repeatable path for translating an OpenDesign-generated
HTML prototype into production Salto code without bypassing the repository's
extension architecture, storage boundaries, or theme system.

## Trigger

Run this workflow when a task asks the agent to implement, restore, migrate,
reproduce, or integrate an OpenDesign HTML prototype or artifact in the code
repository. This includes prototypes for the extension popup, options/settings
page, and page-mounted content UI.

Do not run this workflow when the task only edits or generates the standalone
prototype, reviews a design without implementing it, or changes unrelated
frontend code that has no OpenDesign artifact as its source.

## Source-of-Truth Order

Treat the OpenDesign artifact as a visual and interaction specification, not as
production code. When it disagrees with the repository, use this order:

1. Product behavior and terminology in `CONTEXT.md` and the ADRs under
   `docs/adr/`.
2. Product and design rules in `PRODUCT.md` and `apps/extension/DESIGN.md`.
3. Existing typed domain contracts, services, repositories, and shared UI
   components.
4. The OpenDesign artifact for layout, hierarchy, content placement, and
   intended interaction states.

Do not ship the artifact in an iframe, inject it with
`dangerouslySetInnerHTML`, or copy its standalone scripts and global styles
into an extension entrypoint.

## Required Technology Stack

- Use the existing `pnpm` workspace. The extension lives in `apps/extension`;
  storage-neutral domain contracts live in `packages/core`.
- Build extension surfaces with WXT, React, and TypeScript. WXT owns extension
  entrypoints and the browser-extension lifecycle.
- Use Tailwind CSS v4 and the existing CSS files for styling. Reuse shadcn
  components backed by Base UI from `apps/extension/src/components/ui/` before
  creating a new primitive.
- Use Hugeicons through `@hugeicons/react` and
  `@hugeicons/core-free-icons`. Do not copy prototype SVG icons or add another
  icon library when an existing icon is suitable.
- Use Vitest and Testing Library for unit and component coverage.
- Treat `package.json` and `pnpm-lock.yaml` as the version source of truth. Do
  not add a parallel router, state library, CSS-in-JS system, component library,
  or replacement framework only to reproduce the prototype.

## Surface Mapping

Map the design to the WXT surface that owns it:

- Browser popup: `apps/extension/entrypoints/popup/`.
- Options/settings page: `apps/extension/entrypoints/options/`.
- Page-mounted selection UI: `apps/extension/entrypoints/content.tsx` and
  components under `apps/extension/src/selection/`. Keep this UI isolated in
  the existing Shadow DOM host.
- Background-owned data, secrets, external requests, and durable mutations:
  `apps/extension/entrypoints/background.ts` and services/repositories under
  `apps/extension/src/`.

An OpenDesign `.artifact.json` file is artifact metadata, not a WXT runtime
entrypoint. A production page still needs the normal WXT files such as
`index.html`, `main.tsx`, and its scoped stylesheet. Split a large prototype
into typed React components by responsibility instead of preserving a
monolithic single-file structure.

## Database and Application Boundaries

- Keep the MVP local-first. Use Dexie over browser IndexedDB through
  `apps/extension/src/db/`; do not add a server database, cloud sync, account
  dependency, or direct REST persistence for prototype-only needs.
- Keep Dexie schema definitions, indexes, migrations, and transactions in
  `apps/extension/src/db/`. Add a versioned migration instead of editing an
  already-shipped schema version in place.
- Access durable data through repositories and services. React components and
  content scripts must not import Dexie tables directly.
- Route persistent writes, API-key use, LLM/dictionary calls, and enrichment
  work through the background service worker and typed messages. Content,
  popup, and options UI own presentation and user intent, not secret-bearing or
  persistent business logic.
- Keep reusable models in `packages/core` storage-adapter neutral: no WXT,
  React, Dexie, browser API, or IndexedDB table types.
- For existing extension UI preferences such as theme mode, use the current
  settings API instead of creating a second storage key or component-local
  persistence path.
- Cover schema and repository changes with migration and repository tests using
  the existing `fake-indexeddb` setup.

## Theme Variables

Read `apps/extension/DESIGN.md` and
`apps/extension/src/theme/linear-theme.css` before translating prototype
styles. OpenDesign colors and type tokens are reference inputs only. Map them
onto the existing semantic `--salto-*` contract; do not paste the artifact's
`--bg`, `--fg`, `--accent`, raw hex, LCH, or one-off component colors into
production components.

Use the semantic roles already defined in `linear-theme.css`:

- Surfaces: `--salto-background`, `--salto-surface`,
  `--salto-surface-subtle`, `--salto-muted`, and `--salto-muted-hover`.
- Text: `--salto-foreground`, `--salto-foreground-secondary`,
  `--salto-muted-foreground`, and `--salto-faint-foreground`.
- Borders and actions: `--salto-border-soft`, `--salto-border`,
  `--salto-border-strong`, `--salto-primary`, `--salto-primary-hover`, and
  `--salto-primary-foreground`.
- Feedback and elevation: `--salto-ring`, `--salto-focus-halo`,
  `--salto-selection`, `--salto-destructive`, and the existing shadow tokens.

When Tailwind utilities need a semantic color, expose the Salto variable
through an `@theme inline` mapping in the surface stylesheet, following
`apps/extension/src/selection/selection-popup.css`. Do not duplicate the
underlying light and dark values.

Mount each React surface inside `.salto-theme-scope` and set `data-theme` to
`light`, `dark`, or `system` through the existing theme hook and settings flow.
For a document entrypoint, also keep
`document.documentElement.dataset.theme` synchronized when needed. Shadow DOM
surfaces must carry their own theme scope because page-level variables are not
a reliable styling boundary.

Reuse the typography, spacing, radius, elevation, density, and single-accent
rules from `apps/extension/DESIGN.md`. The artifact must not override the
product's Inter/system typography, compact sizing, restrained radii, or ban on
decorative gradients.

Define a new semantic token once in the base mapping. When its source value
changes by theme, add the underlying runtime value to the light, explicit-dark,
and system-dark selectors instead of redefining the semantic token in every
component. Keep component-specific values local unless at least two surfaces
genuinely share the same semantic role.

## Workflow

1. Inspect the complete artifact.

   List its surfaces, controls, responsive changes, content hierarchy, and
   visible states: default, hover, focus, active, disabled, loading, empty,
   success, and error. Keep useful `data-od-id` markers on major surfaces while
   implementing or comparing the design, but never use them as application
   logic or styling hooks.

2. Identify the owning WXT surface.

   Compare the artifact with current product and domain requirements, then map
   each interaction to the correct entrypoint, component, service, and message
   boundary.

3. Implement typed production components.

   Reuse shared UI primitives and Hugeicons. Use semantic HTML, keep DOM order
   aligned with keyboard order, and separate rendering from business logic.

4. Connect real application data.

   Use the established background messaging, service, and repository paths. Do
   not leave prototype-only mock data or direct storage access in a production
   path.

5. Translate the visual system.

   Map visual values to `--salto-*` variables and verify `light`, `dark`, and
   `system` themes. Make layouts responsive to the real surface: fixed popup
   bounds, resizable options pages, and viewport-edge-safe content overlays.

6. Add focused tests and run repository checks.

   ```bash
   pnpm --filter @salto/extension typecheck
   pnpm --filter @salto/extension test
   pnpm --filter @salto/extension build
   ```

7. Verify the built extension in Chrome/Chromium.

   Compare it with the artifact at relevant viewport sizes. Verify keyboard
   navigation, visible focus, Escape/dismiss behavior, loading/empty/error
   states, reduced motion, text overflow, contrast, and host-page CSS
   isolation.

## Completion Criteria

The implementation is complete only when it:

- reproduces the intended hierarchy and interactions with real application
  data
- respects the WXT, background, repository, and storage boundaries
- uses the semantic theme contract in light, dark, and system modes
- handles relevant responsive and interaction states
- passes type checking, tests, build, and browser verification

Pixel similarity alone is not sufficient.
