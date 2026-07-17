# Phase 04: Add Save And Restart-Safe Enrichment

Status: ready-for-agent

Depends on: Phase 03

## Outcome

Saving succeeds after a local transaction and never waits for remote enrichment. Per-field jobs run in the background, recover after service-worker or browser interruption, support targeted retry, and generate a meaning-recall card when term and meaning are ready.

## Provider Preconditions

- Use the dependency-injected deterministic dictionary fake from Phase 02 to prove dictionary-backed job, retry, and meaning-card behavior in tests and development acceptance.
- Real OpenAI-compatible execution from Phase 03 may fill LLM-backed fields.
- In production, a dictionary job with no accepted active adapter remains queued with its field pending; missing provider configuration is not counted as a remote attempt or converted into a failed field.
- Live dictionary execution and production adapter acceptance belong to Phase 06.

## Save Transaction Tasks

- [x] Implement `SaveVocabularyService` over repository ports.
- [x] Apply the frozen English NFKC, whitespace, and `en-US` lowercase algorithm to form the canonical key without lemmatization or punctuation rewriting.
- [x] Create or reuse one `VocabularyItem` per canonical key.
- [x] Create the system term field as ready with a deterministic field ID.
- [x] Derive a deterministic `VocabularyContext` ID from vocabulary item ID, normalized page URL, and normalized sentence exactly as frozen in the PRD.
- [x] Create missing fixed vocabulary fields with pending status.
- [x] Create extension-local jobs only for fields requiring remote enrichment.
- [x] Derive every job's field/source pair from `VocabularyFieldSpec`; the system `term` field can never have a job.
- [x] Commit item, fields, context, and jobs in one Dexie transaction.
- [x] Return saved or already-saved state immediately after the local transaction.
- [x] Make repeated save messages and repeated transactions idempotent.

## Enrichment Job Model

- [x] Persist job ID, vocabulary item ID, field key, source, status, attempts, next run time, and sanitized last error without sync metadata.
- [x] Support `queued`, `running`, `succeeded`, and `failed` states.
- [x] Define a maximum attempt policy and deterministic exponential backoff with a cap.
- [x] Define stale-running recovery for workers terminated mid-request.
- [x] Store enough state to resume without relying on service-worker globals.
- [x] Keep job records extension-local and outside sync metadata.

## Worker Tasks

- [x] Register runtime, alarm, and installation listeners synchronously.
- [x] Wake the queue after a successful save and through `chrome.alarms` for delayed retries.
- [x] Claim runnable jobs atomically to avoid duplicate execution.
- [x] Batch jobs by vocabulary item and provider when one remote call can fill several fields.
- [x] Persist each field result independently, even when execution was batched.
- [x] Convert provider failures into field and job errors without rolling back successful siblings.
- [x] Recover stale claims when the service worker starts again.
- [x] Prevent concurrent wakeups from processing the same job twice.

## Retry And Card Generation Tasks

- [x] Expose retry for failed fields through a specific background command.
- [x] Retry only failed fields and preserve ready values.
- [x] Clear obsolete error text when a field succeeds.
- [x] Recalculate item-level enrichment display state from field states rather than storing a second source of truth unless an ADR requires it.
- [x] Generate one deterministic meaning-recall card when term and meaning are both ready.
- [x] Reference vocabulary field keys from the card rather than snapshotting front and back text.
- [x] Do not create LearningState, scheduling behavior, or review UI in this phase unless required for schema integrity.

## UI Tasks

- [x] Change the panel save button immediately to saved or already-saved state.
- [x] Do not block close or reading flow while enrichment runs.
- [x] Show a compact failure indication when save itself fails.
- [x] Provide a retry entry point where failed vocabulary fields are surfaced; avoid adding a complete vocabulary manager unless separately planned.

## Automated Verification

- [x] Save tests cover new item, repeated item, same context, and new context.
- [x] Transaction tests prove partial writes do not survive failure.
- [x] Job tests cover claim, success, partial success, retry, backoff, max attempts, and stale recovery.
- [x] Job tests prove missing production provider configuration consumes no attempt and leaves the field pending.
- [x] Concurrency tests prove two queue wakeups do not duplicate work.
- [x] Restart tests create a new worker/service instance over the same database and complete queued work.
- [x] Card tests prove generation waits for both fields and remains idempotent.
- [x] Security tests prove enrichment requests read secrets only in background-owned code.

## Manual Browser Acceptance

1. Save a new term and verify the UI acknowledges it before remote enrichment finishes.
2. Save it again on the same sentence and verify no duplicate item or context.
3. Save it on another page or sentence and verify one additional context.
4. Terminate the service worker while a job is pending or running.
5. Restart Chrome or the extension and verify the job resumes or is safely retried.
6. With the deterministic development dictionary adapter, force one field to fail and verify successful fields remain ready.
7. Retry the failed field and verify one meaning-recall card appears after meaning succeeds.
8. In a production build without an accepted dictionary adapter, verify dictionary jobs remain queued and pending without consuming attempts.

## Exit Criteria

- [x] Save latency is bounded by local persistence, not provider response time.
- [x] Queue state survives service-worker and browser restarts.
- [x] Repeated commands, wakeups, and retries are idempotent.
- [x] Field-level success and failure match ADR-0023.
- [x] Meaning-recall card generation matches ADR-0018 through ADR-0020.
- [x] Production dictionary work remains pending until Phase 06 instead of using a fake or failing without a provider request.
- [x] Full test, typecheck, and build commands pass.

## Rollback Boundary

Job processing can be disabled while preserving saved vocabulary and pending jobs. Database changes require a forward Dexie migration; never solve rollback by deleting the user's IndexedDB.

## Comments

- 2026-07-16: Created from the ordered MVP development plan.
- 2026-07-17: Implemented. Save transaction commits item, fields, context, and jobs atomically via `DexieSaveVocabularyService`. Background enrichment queue uses deterministic dictionary fake in development and keeps dictionary jobs queued without consuming attempts in production. Meaning-recall cards are generated idempotently once term and meaning are ready. Retry surfaced in a minimal Vocabulary settings section.
