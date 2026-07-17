# Phase 03: Add OpenAI-Compatible Translation

Status: ready-for-human

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

- [x] Persist provider, base URL, model, optional temperature, and API-key secret in extension-local settings.
- [x] Separate secret reads from public settings reads so content responses cannot serialize the key accidentally.
- [x] Add the minimum options UI needed to enter and validate the configuration.
- [x] Add a user-initiated connection test with clear timeout, authentication, permission, and model errors.
- [x] Implement the PRD's frozen optional-host-permission flow: request only `<origin>/*` from the Save/Test user gesture and persist only after grant.
- [x] Normalize base URLs; reject credential-bearing, malformed, and non-HTTP(S) URLs; allow HTTP and HTTPS provider origins.
- [x] Remove an obsolete LLM-origin grant with explicit confirmation after configuration replacement when no active provider uses it.

## Request Tasks

- [x] Implement an `LlmClient` adapter under the extension boundary.
- [x] Build one request containing every enabled LLM field ID, frozen `text | list` type, instruction, and rendered required-string `PromptContext`.
- [x] Require a machine-parseable response keyed by field ID.
- [x] Validate each returned value against its declared `text` or `list` type.
- [x] Preserve template order after mapping provider output back to field results.
- [x] Represent missing or invalid fields as field-level failures rather than failing successful siblings.
- [x] Add request timeout and `AbortSignal` cancellation when the panel closes or regenerates.
- [x] Ensure refresh/regenerate creates a new request and ignores stale completion from the previous request.

## Prompt Tasks

- [x] Implement one template-variable renderer using the frozen public variable names.
- [x] Escape or delimit page content so source text cannot impersonate system instructions accidentally.
- [x] Bound `webContent` to the PRD limit before messaging and before request construction.
- [x] Treat unknown variables as a saved-template warning; runtime rendering must leave a visible diagnostic rather than silently substitute incorrect data.
- [x] Show the PRD-defined page-context transmission disclosure and transmit only context referenced by enabled instructions after explicit trigger activation.

## Error And Security Tasks

- [x] Map network, timeout, permission, authentication, rate-limit, provider, parse, and schema failures to stable application errors.
- [x] Do not include API keys, authorization headers, full prompts, or full page content in logs and user-facing errors.
- [x] Prevent content scripts from requesting arbitrary URLs through a generic background fetch message.
- [x] Restrict background fetches to the configured provider path and request shape.
- [x] Verify retries are always user-initiated in this phase; automatic enrichment retry belongs to Phase 04.

## Automated Verification

- [x] Adapter tests cover URL construction, headers, timeout, cancellation, and non-2xx responses.
- [x] Prompt tests cover every supported variable and unknown-variable behavior.
- [x] Response tests cover text, list, missing, malformed, extra, and reordered fields.
- [x] Service tests prove several LLM fields produce one provider call.
- [x] Security tests prove public settings and translation responses contain no API key.
- [x] UI tests cover retry, regenerate, stale-response suppression, and partial field failure.
- [x] Default tests use a local fake HTTP boundary or mocked fetch, never a live paid API.

## Manual Browser Acceptance

1. Save a valid OpenAI-compatible configuration through options.
2. Run the connection test and verify a useful success state.
3. Select text and open a template containing at least two LLM fields.
4. Verify one request produces ordered field output.
5. Regenerate rapidly and verify stale output does not replace the latest result.
6. Test invalid key, invalid model, timeout, and denied host permission states.
7. Inspect extension messages and confirm the API key never enters the content-script context.
8. Replace the configured origin and verify the obsolete grant can be removed without changing unrelated host permissions.

## Exit Criteria

- [ ] Real LLM translation works from explicit selection intent.
- [x] Several LLM fields use exactly one provider request.
- [x] Field-level schema failures are isolated.
- [x] Secrets and arbitrary-fetch capability remain background-owned.
- [x] Full test, typecheck, and build commands pass.

## Rollback Boundary

The fake executor remains available only for tests and development fixtures. The production LLM adapter can be disabled without removing the local vertical slice or saved-vocabulary data.

## Comments

- 2026-07-16: Created from the ordered MVP development plan.
- 2026-07-17: Implemented the background-owned AI SDK adapter, split public/secret storage, exact-origin permission flow, options configuration, prompt rendering, cancellation, stale-response suppression, stable errors, and field-level response validation.
- 2026-07-17: Verified `pnpm typecheck`, `pnpm test` (116 tests), and `pnpm build`; production manifest uses only optional HTTP/HTTPS host permissions, and production bundles contain no local API credentials.
- 2026-07-17: Review fixes re-request revoked origin permissions from every Test gesture, expose active-template context variables and unknown-variable warnings, accept correctly typed empty lists, and render connection failures with destructive semantics.
- 2026-07-17: Verified a live AI SDK connection and two-field structured generation with the local `MODEL_NAME` through a loopback proxy, then checked the options page at 390x844 without horizontal overflow. The browser Save/Test flow reached Chrome's native optional-permission prompt; accepting that prompt and refreshing the write-only key state remains a manual check because the test desktop was locked.
- 2026-07-17: Product decision changed to allow public HTTP provider origins. The manifest exposes HTTP only as an optional capability; Save/Test still requests the exact configured `<origin>/*` grant.
- 2026-07-17: Verified the configured model through AI SDK directly against the public HTTP base URL without a loopback proxy.
