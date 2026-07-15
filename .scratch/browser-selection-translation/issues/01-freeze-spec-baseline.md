# Phase 01: Freeze The MVP Specification

Status: ready-for-agent

Depends on: current PRD, CONTEXT, and ADRs

## Outcome

Produce one implementation contract for the first vertical slice. This phase is a time-boxed decision pass, not a general rewrite of all product documentation.

No runtime feature work should begin while a decision below remains ambiguous.

## Blocking Decisions

| Topic | Current conflict | Planned resolution |
| --- | --- | --- |
| Vocabulary names | PRD still contains `WordItem` and `WordField`; ADRs use `Vocabulary*` | Use `VocabularyItem`, `VocabularyField`, and `VocabularyContext` everywhere except user-facing "saved word" copy |
| Query field value types | PRD uses `text \| list`; core uses `text \| markdown` | Use `text \| list` for MVP unless a new ADR explicitly replaces the PRD |
| Vocabulary field values | Core currently represents only a string; several fixed fields are lists | Support `string \| readonly string[]` with the field schema determining the valid shape |
| Prompt variables | PRD and core use different page-context names and optionality | Freeze the public template names from the PRD and define a single typed `PromptContext` mapping |
| Enrichment jobs | PRD models jobs next to syncable records | Keep `EnrichmentJob` extension-local and out of future sync contracts |
| Saved-word settings | PRD lists a settings section; ADRs prohibit field customization | Remove mutable saved-word field settings from MVP; an informational schema view is optional |
| Learning scope | ADRs require meaning-recall cards; PRD defers review algorithms | Generate card records after term and meaning are ready; do not build scheduler or review UI |
| Dictionary rollout | PRD lists two initial providers | Ship one adapter to stable acceptance before implementing the second |

## Task Checklist

- [ ] Update the PRD local data model to the current responsibility-specific vocabulary model.
- [ ] Replace `WordItem`, `WordField`, and canonical-key foreign keys with ID-based `Vocabulary*` relationships.
- [ ] Document which records are syncable and which remain extension-local.
- [ ] Freeze `QuerySchemaField`, field-result, and PromptContext value shapes.
- [ ] Define exact canonical-key behavior for English words and short phrases without lemmatization.
- [ ] Define vocabulary-context deduplication inputs: vocabulary item, normalized page URL, and sentence context.
- [ ] Define the fixed vocabulary schema, source of each field, and list-versus-text value type.
- [ ] Define the minimum extension settings required by Phases 02-04.
- [ ] Decide how user-entered LLM origins receive host permission without exposing unnecessary remote access.
- [ ] Record page-content transmission and API-key handling expectations in the PRD.
- [ ] Split Phases 02-08 into numbered local issues with acceptance criteria and `ready-for-agent` status.
- [ ] Add an ADR only when the resolution introduces a new durable architecture decision; do not create ADRs for routine implementation details.

## Consistency Review

- [ ] Every domain term used by planned issue titles exists in `CONTEXT.md`.
- [ ] No planned behavior contradicts ADR-0003, ADR-0004, ADR-0015, ADR-0021, ADR-0022, ADR-0023, ADR-0026, or ADR-0030.
- [ ] The PRD user flow can be expressed using the frozen model without aliases or legacy names.
- [ ] The settings list no longer promises controls that the fixed vocabulary schema prohibits.
- [ ] Deferred review, sync, import/export, and mobile work remain explicitly out of scope.

## Verification

This phase has no browser behavior. Verification is a structured document review:

1. Trace every PRD user-flow step to one or more planned issues.
2. Trace every new persisted record to an ADR-defined ownership boundary.
3. Trace every external request to a background-owned path.
4. Search for legacy model names and explain or remove every remaining use.
5. Confirm all implementation issues have an owner-ready status and an acceptance section.

## Exit Criteria

- [ ] The blocking-decision table is reflected in authoritative documentation.
- [ ] PRD, CONTEXT, ADRs, and planned core contracts describe one model.
- [ ] Phase 02 can be implemented without making another product-level choice.
- [ ] Every unresolved non-blocking question is recorded with an owner and does not affect the vertical slice.

## Rollback Boundary

This phase changes documentation and issue definitions only. If a decision is rejected, revert that decision and dependent issue text before runtime code relies on it.

## Comments

- 2026-07-16: Created from the ordered MVP development plan.
