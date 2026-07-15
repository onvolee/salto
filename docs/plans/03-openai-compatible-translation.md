# Phase 03: Add OpenAI-Compatible Translation

Status: planned

Depends on: Phase 02

## Outcome

Replace the fake LLM execution path with one active OpenAI-compatible configuration owned by the background service worker. All enabled LLM fields in the active query template are executed in one request and returned as independent field results.

## Scope Decisions

- One active provider configuration only.
- One model per active configuration.
- No provider fallback, streaming requirement, usage accounting, or multi-profile management.
- Translation output remains transient and never populates vocabulary fields.
- The content script may send PromptContext, but it never receives the API key.

## Configuration Tasks

- [ ] Persist provider, base URL, model, optional temperature, and API-key secret in extension-local settings.
- [ ] Separate secret reads from public settings reads so content responses cannot serialize the key accidentally.
- [ ] Add the minimum options UI needed to enter and validate the configuration.
- [ ] Add a user-initiated connection test with clear timeout, authentication, permission, and model errors.
- [ ] Decide and implement host-permission acquisition for the configured origin.
- [ ] Normalize base URLs and reject non-HTTP(S), credential-bearing, or malformed URLs.

## Request Tasks

- [ ] Implement an `LlmClient` adapter under the extension boundary.
- [ ] Build one request containing every enabled LLM field ID, type, instruction, and rendered PromptContext.
- [ ] Require a machine-parseable response keyed by field ID.
- [ ] Validate each returned value against its declared `text` or `list` type.
- [ ] Preserve template order after mapping provider output back to field results.
- [ ] Represent missing or invalid fields as field-level failures rather than failing successful siblings.
- [ ] Add request timeout and `AbortSignal` cancellation when the panel closes or regenerates.
- [ ] Ensure refresh/regenerate creates a new request and ignores stale completion from the previous request.

## Prompt Tasks

- [ ] Implement one template-variable renderer using the frozen public variable names.
- [ ] Escape or delimit page content so source text cannot impersonate system instructions accidentally.
- [ ] Bound `webContent` to the PRD limit before messaging and before request construction.
- [ ] Treat unknown variables as a saved-template warning; runtime rendering must leave a visible diagnostic rather than silently substitute incorrect data.
- [ ] Document that selected page context is transmitted to the user-configured provider only after explicit trigger activation.

## Error And Security Tasks

- [ ] Map network, timeout, permission, authentication, rate-limit, provider, parse, and schema failures to stable application errors.
- [ ] Do not include API keys, authorization headers, full prompts, or full page content in logs and user-facing errors.
- [ ] Prevent content scripts from requesting arbitrary URLs through a generic background fetch message.
- [ ] Restrict background fetches to the configured provider path and request shape.
- [ ] Verify retries are always user-initiated in this phase; automatic enrichment retry belongs to Phase 04.

## Automated Verification

- [ ] Adapter tests cover URL construction, headers, timeout, cancellation, and non-2xx responses.
- [ ] Prompt tests cover every supported variable and unknown-variable behavior.
- [ ] Response tests cover text, list, missing, malformed, extra, and reordered fields.
- [ ] Service tests prove several LLM fields produce one provider call.
- [ ] Security tests prove public settings and translation responses contain no API key.
- [ ] UI tests cover retry, regenerate, stale-response suppression, and partial field failure.
- [ ] Default tests use a local fake HTTP boundary or mocked fetch, never a live paid API.

## Manual Browser Acceptance

1. Save a valid OpenAI-compatible configuration through options.
2. Run the connection test and verify a useful success state.
3. Select text and open a template containing at least two LLM fields.
4. Verify one request produces ordered field output.
5. Regenerate rapidly and verify stale output does not replace the latest result.
6. Test invalid key, invalid model, timeout, and denied host permission states.
7. Inspect extension messages and confirm the API key never enters the content-script context.

## Exit Criteria

- [ ] Real LLM translation works from explicit selection intent.
- [ ] Several LLM fields use exactly one provider request.
- [ ] Field-level schema failures are isolated.
- [ ] Secrets and arbitrary-fetch capability remain background-owned.
- [ ] Full test, typecheck, and build commands pass.

## Rollback Boundary

The fake executor remains available only for tests and development fixtures. The production LLM adapter can be disabled without removing the local vertical slice or saved-vocabulary data.

