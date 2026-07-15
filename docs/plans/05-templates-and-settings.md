# Phase 05: Add Query Templates And Required Settings

Status: planned

Depends on: Phases 03 and 04

## Outcome

Users can control reading-time query output through persisted templates and can configure the settings required by the translation, enrichment, and highlight workflows.

This phase does not turn the options page into a general product dashboard. Required workflow settings come first; appearance and UI-language work are integrated only when already implemented or separately accepted.

## Query Template Tasks

- [ ] Seed at least one immutable system template on first use.
- [ ] Create user templates from defaults or from another template.
- [ ] Copy and rename templates with collision-safe IDs.
- [ ] Delete user-created templates while preventing deletion of the last usable template.
- [ ] Set and persist one default template.
- [ ] Edit field label, type, source, instruction, enabled state, and order.
- [ ] Reorder fields with keyboard-accessible controls in addition to any pointer interaction.
- [ ] Normalize order values transactionally after edits.
- [ ] Preserve unknown provider or field data defensively during future migrations rather than silently dropping it.

## Prompt Variable Tasks

- [ ] Provide an insertion menu for every supported PromptContext variable.
- [ ] Parse manually typed variables using the same parser used at runtime.
- [ ] Warn about unknown variables when saving but do not block the save.
- [ ] Distinguish unknown variables from temporarily unavailable context values.
- [ ] Show a concise preview or validation summary without sending a provider request on every edit.

## Required Settings Tasks

- [ ] Complete the single active LLM configuration from Phase 03.
- [ ] Persist target translation language.
- [ ] Persist active dictionary provider after Phase 06 is available.
- [ ] Persist highlight enabled state.
- [ ] Integrate existing theme-mode behavior without redesigning the theme system in this phase.
- [ ] Keep fixed vocabulary fields read-only; do not add hide, source, or edit controls.
- [ ] Do not expose raw API-key values after save; display only configured/not-configured state and an explicit replace action.

## Runtime Integration Tasks

- [ ] Load the default template when a panel opens.
- [ ] Allow template switching in the panel without changing the global default implicitly.
- [ ] Define whether switching triggers execution immediately or through an explicit run action; keep the behavior consistent and tested.
- [ ] Apply template edits to subsequent runs without requiring an extension reload.
- [ ] Subscribe extension surfaces to relevant setting changes and remove listeners on unmount.
- [ ] Recover safely when the selected/default template was deleted or corrupted.

## Validation And Persistence Tasks

- [ ] Validate names, field counts, order, source, type, and instructions at the background write boundary.
- [ ] Keep options components free of direct Dexie table access.
- [ ] Store template and extension-setting timestamps for migration and troubleshooting.
- [ ] Add an idempotent migration path from seeded or earlier setting shapes.
- [ ] Separate public settings reads from secret settings reads.

## Automated Verification

- [ ] Repository tests cover create, copy, update, delete, set-default, and recovery.
- [ ] Variable-parser tests cover valid, repeated, adjacent, unknown, and malformed variables.
- [ ] UI tests cover unsaved changes, validation warning, reorder, deletion guard, and API-key replacement.
- [ ] Runtime tests prove a template edit changes the next translation request.
- [ ] Migration tests cover missing, old, and malformed settings.
- [ ] Accessibility tests cover labels, focus order, keyboard reorder, error association, and contrast-critical states.

## Manual Browser Acceptance

1. Create a template with two LLM fields and persist it.
2. Copy it, change field order and instruction, and set the copy as default.
3. Insert all supported variable types and verify unknown-variable warning behavior.
4. Open a page, switch templates, and verify ordered output changes as specified.
5. Reload Chrome and verify templates and required settings persist.
6. Replace the API key and verify the previous key cannot be read back through UI or messages.
7. Navigate the complete options workflow with keyboard only.

## Exit Criteria

- [ ] Template CRUD and default recovery are durable and validated.
- [ ] Runtime query behavior reflects template changes predictably.
- [ ] Only settings required by the MVP workflow are mandatory for phase closure.
- [ ] Fixed vocabulary schema decisions remain intact.
- [ ] Full test, typecheck, and build commands pass.

## Non-Goals

- Template import/export
- Multiple LLM profiles
- Per-template model selection
- Vocabulary-field editing or source changes
- A vocabulary management dashboard
- New visual customization beyond accepted existing theme behavior

## Rollback Boundary

Template-management UI can be reverted while preserving seeded default-template execution. Schema changes must retain existing user templates through forward migration.

