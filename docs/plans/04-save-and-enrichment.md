# Phase 04: Add Save And Restart-Safe Enrichment

Status: planned

Depends on: Phase 03

## Outcome

Saving succeeds after a local transaction and never waits for remote enrichment. Per-field jobs run in the background, recover after service-worker or browser interruption, support targeted retry, and generate a meaning-recall card when term and meaning are ready.

## Save Transaction Tasks

- [ ] Implement `SaveVocabularyService` over repository ports.
- [ ] Normalize term and language into the frozen canonical key without lemmatization.
- [ ] Create or reuse one `VocabularyItem` per canonical key.
- [ ] Create the system term field as ready with a deterministic field ID.
- [ ] Append a deterministic, deduplicated `VocabularyContext` when page URL and sentence differ.
- [ ] Create missing fixed vocabulary fields with pending status.
- [ ] Create extension-local jobs only for fields requiring remote enrichment.
- [ ] Commit item, fields, context, and jobs in one Dexie transaction.
- [ ] Return saved or already-saved state immediately after the local transaction.
- [ ] Make repeated save messages and repeated transactions idempotent.

## Enrichment Job Model

- [ ] Persist job ID, vocabulary item ID, field key, source, status, attempts, next run time, and last error.
- [ ] Support `queued`, `running`, `succeeded`, and `failed` states.
- [ ] Define a maximum attempt policy and deterministic exponential backoff with a cap.
- [ ] Define stale-running recovery for workers terminated mid-request.
- [ ] Store enough state to resume without relying on service-worker globals.
- [ ] Keep job records extension-local and outside sync metadata.

## Worker Tasks

- [ ] Register runtime, alarm, and installation listeners synchronously.
- [ ] Wake the queue after a successful save and through `chrome.alarms` for delayed retries.
- [ ] Claim runnable jobs atomically to avoid duplicate execution.
- [ ] Batch jobs by vocabulary item and provider when one remote call can fill several fields.
- [ ] Persist each field result independently, even when execution was batched.
- [ ] Convert provider failures into field and job errors without rolling back successful siblings.
- [ ] Recover stale claims when the service worker starts again.
- [ ] Prevent concurrent wakeups from processing the same job twice.

## Retry And Card Generation Tasks

- [ ] Expose retry for failed fields through a specific background command.
- [ ] Retry only failed fields and preserve ready values.
- [ ] Clear obsolete error text when a field succeeds.
- [ ] Recalculate item-level enrichment display state from field states rather than storing a second source of truth unless an ADR requires it.
- [ ] Generate one deterministic meaning-recall card when term and meaning are both ready.
- [ ] Reference vocabulary field keys from the card rather than snapshotting front and back text.
- [ ] Do not create LearningState, scheduling behavior, or review UI in this phase unless required for schema integrity.

## UI Tasks

- [ ] Change the panel save button immediately to saved or already-saved state.
- [ ] Do not block close or reading flow while enrichment runs.
- [ ] Show a compact failure indication when save itself fails.
- [ ] Provide a retry entry point where failed vocabulary fields are surfaced; avoid adding a complete vocabulary manager unless separately planned.

## Automated Verification

- [ ] Save tests cover new item, repeated item, same context, and new context.
- [ ] Transaction tests prove partial writes do not survive failure.
- [ ] Job tests cover claim, success, partial success, retry, backoff, max attempts, and stale recovery.
- [ ] Concurrency tests prove two queue wakeups do not duplicate work.
- [ ] Restart tests create a new worker/service instance over the same database and complete queued work.
- [ ] Card tests prove generation waits for both fields and remains idempotent.
- [ ] Security tests prove enrichment requests read secrets only in background-owned code.

## Manual Browser Acceptance

1. Save a new term and verify the UI acknowledges it before remote enrichment finishes.
2. Save it again on the same sentence and verify no duplicate item or context.
3. Save it on another page or sentence and verify one additional context.
4. Terminate the service worker while a job is pending or running.
5. Restart Chrome or the extension and verify the job resumes or is safely retried.
6. Force one field to fail and verify successful fields remain ready.
7. Retry the failed field and verify one meaning-recall card appears after meaning succeeds.

## Exit Criteria

- [ ] Save latency is bounded by local persistence, not provider response time.
- [ ] Queue state survives service-worker and browser restarts.
- [ ] Repeated commands, wakeups, and retries are idempotent.
- [ ] Field-level success and failure match ADR-0023.
- [ ] Meaning-recall card generation matches ADR-0018 through ADR-0020.
- [ ] Full test, typecheck, and build commands pass.

## Rollback Boundary

Job processing can be disabled while preserving saved vocabulary and pending jobs. Database changes require a forward Dexie migration; never solve rollback by deleting the user's IndexedDB.

