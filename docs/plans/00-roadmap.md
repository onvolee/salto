# Salto MVP v0.1 Development Roadmap

Status: planned

## Purpose

This directory is the ordered implementation plan for Salto MVP v0.1. It turns the product PRD and ADRs into small, verifiable delivery stages.

The plan deliberately favors vertical slices over completing every abstraction up front. Each stage must produce either a user-observable behavior or a verified reduction of a concrete technical risk.

## Sources Of Truth

- Product scope: `.scratch/browser-selection-translation/PRD.md`
- Domain vocabulary and current decisions: `CONTEXT.md`
- Architecture decisions: `docs/adr/`
- Implementation issues and status: `.scratch/browser-selection-translation/issues/`
- Ordered execution plan: `docs/plans/`

When these documents conflict, stop the affected implementation, resolve the conflict in Phase 01, and record the decision in the PRD, CONTEXT, or an ADR as appropriate. Do not silently choose one model in code.

## Current Baseline

- [x] pnpm workspace with `apps/extension` and `packages/core`
- [x] WXT Manifest V3 extension shell
- [x] Shadow DOM selection trigger and panel foundation
- [x] Selection validation and viewport positioning tests
- [x] Initial storage-neutral vocabulary and learning contracts
- [x] Initial Dexie database shell
- [ ] Translation execution
- [ ] Background-owned persistence and request services
- [ ] Save and enrichment workflow
- [ ] Query-template management
- [ ] Production dictionary adapters
- [ ] Saved-vocabulary highlighting
- [ ] MVP browser acceptance suite

The baseline must be revalidated before implementation starts because other work may have landed since this plan was written.

## Execution Order

| Order | Plan | User-observable result | Depends on |
| --- | --- | --- | --- |
| 01 | [Freeze the specification](01-spec-baseline.md) | One unambiguous MVP contract | Current PRD and ADRs |
| 02 | [Build the local vertical slice](02-local-vertical-slice.md) | Select, fake-translate, save, reload, highlight | 01 |
| 03 | [Add real LLM translation](03-openai-compatible-translation.md) | Real mixed-field LLM output | 02 |
| 04 | [Add save and enrichment recovery](04-save-and-enrichment.md) | Immediate save and restart-safe enrichment | 03 |
| 05 | [Add templates and required settings](05-templates-and-settings.md) | User-controlled query behavior | 03, 04 |
| 06 | [Add dictionary adapters](06-dictionary-adapters.md) | Dictionary-backed query and enrichment fields | 04, 05 |
| 07 | [Harden page highlighting](07-highlighting.md) | Correct, incremental highlighting on real pages | 02, 04 |
| 08 | [Harden and release the MVP](08-hardening-and-release.md) | Reproducible Chrome-ready MVP | 01-07 |

The order is the default critical path. Phase 07 may begin after Phase 04 while Phase 05 or 06 is in progress, but it must not be released independently from the completed save semantics it consumes.

## Issue Sizing Rules

Each plan file should be split into implementation issues under `.scratch/browser-selection-translation/issues/` before coding that phase.

An issue is correctly sized when:

- It has one primary behavior or risk.
- It can be implemented and verified without waiting for another unfinished issue in the same branch.
- It keeps behavior and the tests that prove it together.
- It can be reverted without removing unrelated functionality.
- Its acceptance steps fit in one short manual browser script.

If an issue contains a repository layer, a service layer, several UI surfaces, and multiple providers, it is too large. Split it by user-visible path or provider boundary.

## Definition Of Done For Every Issue

- [ ] Preconditions and acceptance criteria are written before implementation.
- [ ] The smallest failing automated test or reproducible fixture exists.
- [ ] The implementation does not broaden the issue scope.
- [ ] Errors are represented explicitly rather than swallowed.
- [ ] Affected unit and integration tests pass.
- [ ] `pnpm test`, `pnpm typecheck`, and `pnpm build` pass before phase closure.
- [ ] The issue's browser acceptance script passes in unpacked Chrome.
- [ ] Security and privacy effects are recorded when page content, secrets, permissions, or remote requests change.
- [ ] Relevant PRD, CONTEXT, ADR, and issue comments are updated.
- [ ] The change is committed as one coherent GitButler change or a small, ordered stack.

## Engineering Guardrails

- Content scripts own page selection, page-context extraction, isolated UI, and highlighting only.
- The background service worker owns IndexedDB writes, API-key access, external requests, and enrichment scheduling.
- Core contracts must not import WXT, React, Dexie, IndexedDB, or browser APIs.
- Translation-panel output never writes directly into vocabulary fields.
- Service-worker correctness must not depend on module-level mutable state.
- Default automated tests must not depend on live LLM or dictionary networks.
- API keys and full page content must not appear in logs, errors, analytics, or content-script responses.
- DOM scans must be bounded, incremental, and cooperative with the page's main thread.

## MVP Non-Goals

- Accounts, cloud sync, or a cloud backend
- Mobile clients
- Review scheduling or a review UI
- Lemmatization and word-form matching
- Dictionary aggregation or fallback orchestration
- Offline dictionary bundles
- User editing of vocabulary field values
- Import and export

Adding any non-goal requires an explicit product decision and a revised plan; it must not enter through incidental refactoring.

