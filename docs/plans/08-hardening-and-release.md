# Phase 08: Harden And Release The MVP

Status: planned

Depends on: Phases 01-07

## Outcome

Produce a reproducible Chrome/Chromium MVP build whose complete PRD flow passes automated checks and documented manual acceptance, with permissions, privacy behavior, migration safety, and operational failure states reviewed.

## Functional Completion Checklist

- [ ] Selection supports words and short phrases up to 500 characters.
- [ ] Selection alone never starts a provider query.
- [ ] Floating trigger and keyboard shortcut both open translation intentionally.
- [ ] Panel stays within viewport, supports drag, outside click, and `Esc`.
- [ ] Active template name, switching, ordered fields, refresh, and save work.
- [ ] LLM and dictionary fields batch by provider and isolate field failures.
- [ ] Save is immediate and independent from translation-panel output.
- [ ] Repeated saves deduplicate vocabulary items and reading contexts correctly.
- [ ] Enrichment resumes after service-worker and browser restart.
- [ ] Failed fields can be retried without overwriting successful fields.
- [ ] Saved terms highlight on initial and dynamic page content.
- [ ] Meaning-recall card records appear only after term and meaning are ready.

## Accessibility And Interaction Tasks

- [ ] Define and register the extension keyboard command in the manifest.
- [ ] Verify logical focus entry, containment where appropriate, and restoration after panel close.
- [ ] Give every icon action an accessible name and tooltip where needed.
- [ ] Verify keyboard-only template, settings, retry, save, and panel workflows.
- [ ] Verify WCAG AA contrast in light, dark, and system modes.
- [ ] Avoid color-only saved, pending, failed, and ready states.
- [ ] Respect reduced motion and avoid animations that shift layout.
- [ ] Verify zoomed and narrow viewport text does not overlap or escape controls.

## Reliability And Migration Tasks

- [ ] Add forward Dexie migration tests from every released schema version.
- [ ] Verify malformed local settings recover to safe defaults without deleting vocabulary.
- [ ] Verify service startup with queued, running, failed, and completed jobs.
- [ ] Define behavior for provider configuration removed while jobs remain queued.
- [ ] Ensure extension update re-registers required defaults, alarms, and commands idempotently.
- [ ] Audit all asynchronous paths for handled rejection and stale-response behavior.

## Security And Privacy Tasks

- [ ] Inventory every manifest permission and host permission with a specific product reason.
- [ ] Remove permissions not exercised by the production build.
- [ ] Verify content scripts cannot access API keys or generic background fetch capability.
- [ ] Verify logs and errors contain no secrets, authorization headers, full page content, or persisted vocabulary values unless explicitly needed and protected.
- [ ] Document when selected text, sentence, nearby paragraphs, title, URL, and page content are sent remotely.
- [ ] Verify provider requests occur only after explicit user intent or a previously authorized saved-word enrichment job.
- [ ] Review packaged output for source maps, fixtures, environment files, and development-only adapters.

## Automated Test Layers

- [ ] Core unit tests: contracts, canonicalization, prompt rendering, field mapping, and card rules.
- [ ] Repository integration tests: transactions, migrations, deduplication, and reopen behavior.
- [ ] Background tests: message validation, provider adapters, queue recovery, retry, and permissions.
- [ ] DOM tests: selection context, panel behavior, and highlighting.
- [ ] Extension smoke tests: production build loaded into a persistent Chrome context.
- [ ] End-to-end golden path: select, translate, save, enrich, reload, and highlight.
- [ ] Failure paths: invalid key, denied permission, provider timeout, parser change, IndexedDB error, worker restart, and dynamic DOM.

## Browser Acceptance Matrix

| Surface | Required scenarios |
| --- | --- |
| Static article | Selection, translation, save, reload, highlight |
| SPA navigation | New content selection and incremental highlights |
| Long page | Bounded scanning while scrolling |
| Form-heavy page | Interactive and editable regions skipped |
| Narrow viewport | Trigger and panel remain reachable |
| Light/dark host pages | Extension surfaces remain legible |
| Extension options | Configuration, templates, validation, keyboard use |
| Worker restart | Translation config reload and enrichment recovery |

Restricted browser pages where content scripts cannot run must fail silently or show extension-level guidance; they are not treated as normal web-page support.

## Release Tasks

- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm build`.
- [ ] Inspect the generated MV3 manifest and packaged file list.
- [ ] Load the exact production output directory into Chrome and execute the acceptance matrix.
- [ ] Update version and release notes only after acceptance passes.
- [ ] If publishing to Chrome Web Store, create or update `CHROMEWEBSTORE.md`, permission justifications, privacy disclosures, screenshots, and package exclusions.
- [ ] Record known provider limitations and support diagnostics.
- [ ] Close local issues only with links or comments containing verification evidence.

## Final Exit Criteria

- [ ] Every PRD user-flow step has passing automated or manual evidence.
- [ ] No open `needs-info` or known severity-high defect blocks the golden path.
- [ ] All production permissions are justified and minimally scoped.
- [ ] Existing user data survives update and failure recovery checks.
- [ ] The production package contains no secrets or development-only network behavior.
- [ ] Test, typecheck, build, unpacked-Chrome smoke, and acceptance matrix all pass from a clean environment.

## Rollback And Release Safety

- Do not publish a schema migration without a tested forward recovery path.
- Keep provider adapters independently disableable through configuration or a patch release.
- Never roll back by clearing IndexedDB or asking users to reinstall unless data loss is explicitly accepted as an emergency response.
- If the golden path regresses, stop release, reopen the owning issue, and attach the reproducible fixture before fixing it.

