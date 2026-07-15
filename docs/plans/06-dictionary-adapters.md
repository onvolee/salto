# Phase 06: Add Dictionary Adapters

Status: planned

Depends on: Phases 04 and 05

## Outcome

One production dictionary adapter reaches stable acceptance before a second adapter is added. Dictionary-backed query-template fields and vocabulary enrichment reuse one lookup per term/provider while preserving field-level results.

## Rollout Strategy

1. Select the first adapter using current access reliability and required field coverage.
2. Complete its fixtures, parser, query execution, enrichment mapping, permission flow, and browser smoke test.
3. Observe and document its failure modes.
4. Implement the second adapter against the same contract only after the first meets exit criteria.

There is no multi-provider aggregation or automatic fallback in MVP. The active provider is explicit.

## Adapter Boundary Tasks

- [ ] Keep provider URL, HTML, cookies, headers, anti-abuse behavior, and parsing outside core contracts.
- [ ] Define a normalized lookup result that can represent phonetic, part of speech, meaning, synonyms, and word forms.
- [ ] Keep unsupported or missing normalized fields distinct from parser failure.
- [ ] Bind each adapter to an explicit provider ID and supported-language capability.
- [ ] Reject unsupported languages before sending a remote request.
- [ ] Add timeout, cancellation, response-size bounds, and content-type checks.

## Fixture And Parser Tasks

- [ ] Capture representative HTML or response fixtures without user-specific cookies or credentials.
- [ ] Include fixtures for a common word, multiple parts of speech, missing fields, not found, and changed/invalid markup.
- [ ] Parse fixtures with structured DOM parsing rather than broad regular expressions over HTML.
- [ ] Keep selectors small and provider-specific.
- [ ] Return a stable parser error when required page structure changes.
- [ ] Document fixture source date and remove irrelevant page content to keep tests maintainable.

## Query Execution Tasks

- [ ] Group enabled query fields by active dictionary provider.
- [ ] Perform at most one lookup per selection/provider/run.
- [ ] Map normalized values to field IDs in original template order.
- [ ] Convert missing values into field-level unavailable results.
- [ ] Do not let one dictionary field failure hide successful LLM fields.
- [ ] Cancel or ignore stale dictionary results during regenerate and panel close.

## Enrichment Tasks

- [ ] Batch pending dictionary-backed vocabulary fields into one lookup per vocabulary item/provider attempt.
- [ ] Persist each normalized field independently.
- [ ] Preserve ready values when another dictionary field fails.
- [ ] Route failed mappings through the Phase 04 retry policy.
- [ ] Avoid overwriting a ready value unless a deliberate refresh policy is defined.

## Permission And Operational Tasks

- [ ] Request only the provider origins required for the active adapter.
- [ ] Show a clear options error when permission is denied.
- [ ] Avoid generic background proxy messages that can fetch arbitrary URLs.
- [ ] Add provider-specific user agent, locale, or cookie behavior only when necessary and documented.
- [ ] Record that Web adapters are brittle, unofficial integrations and may require replacement.
- [ ] Keep live provider smoke tests explicit and opt-in.

## Automated Verification

- [ ] Contract tests run unchanged against each adapter.
- [ ] Parser fixture tests cover every normalized output field and failure class.
- [ ] Query tests prove multiple dictionary fields make one lookup.
- [ ] Enrichment tests prove field-level persistence and retry.
- [ ] Permission tests cover missing and denied provider origins.
- [ ] Default test suites perform no live dictionary requests.

## Manual Browser Acceptance Per Provider

1. Enable the provider and grant only its required host permission.
2. Translate a common word with several dictionary-backed query fields.
3. Verify exactly one provider lookup and ordered mixed LLM/dictionary output.
4. Save the word and verify dictionary enrichment fills supported fixed fields.
5. Test not-found, malformed response, timeout, and permission-denied states.
6. Confirm a failed dictionary field does not remove successful LLM or dictionary siblings.

## Exit Criteria

- [ ] The first adapter passes all acceptance checks before work begins on the second.
- [ ] Provider-specific behavior does not leak into core vocabulary contracts.
- [ ] Query and enrichment paths both reuse one normalized lookup.
- [ ] Live-network instability cannot fail the default CI test suite.
- [ ] Full test, typecheck, and build commands pass.

## Rollback Boundary

Each adapter is independently selectable and removable. Disabling a broken adapter must not corrupt templates, vocabulary fields, or jobs; affected jobs remain failed and retryable after a replacement provider is selected deliberately.

