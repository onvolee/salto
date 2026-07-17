# AGENTS.md instructions

## Agent skills

### Issue tracker

Issues and PRDs are tracked as local markdown files under `.scratch/`; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

The tracker uses the default five-label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain layout with `CONTEXT.md` at the root and ADRs under `docs/adr/`. See `docs/agents/domain.md`.

### OpenDesign prototype implementation

Before coding, read and execute `.salto/workflow/opendesign-html-implementation.md` when a task asks you to implement, restore, migrate, reproduce, or integrate an OpenDesign-generated HTML prototype or artifact in the production repository. This applies to popup, options/settings, and page-mounted extension UI. Do not load the workflow when only generating/editing the standalone prototype, reviewing a design without implementation, or changing unrelated frontend code.

### Short cut keys
Execute the command after triggering the key shortcut key.

- `gflow`: .salto/workflow/salto-github-workflow.md use this file content and exec it
