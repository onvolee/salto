# Phase 07: Harden Saved-Vocabulary Highlighting

Status: planned

Depends on: Phases 02 and 04

## Outcome

Saved English vocabulary is highlighted correctly on initial and dynamically updated pages without breaking host-page DOM behavior or causing noticeable input and scroll stalls.

The minimal Phase 02 highlighter is replaced or evolved behind a testable scanning boundary.

## Matching Rules

- Case-insensitive English matching
- Full word boundaries only
- No lemmatization or word-form matching
- No matching across DOM text nodes
- No highlighting inside Salto-owned UI
- No highlighting inside interactive, editable, code, or already-highlighted regions
- One visible wavy underline style that does not rely on color alone for saved-state meaning elsewhere in the UI

## Matching Engine Tasks

- [ ] Normalize and deduplicate saved terms before constructing matchers.
- [ ] Escape all term text before creating any regular expression.
- [ ] Prefer longest valid term when saved phrases overlap saved words within one text node.
- [ ] Define Unicode and apostrophe behavior explicitly for English boundaries.
- [ ] Keep pure match calculation separate from DOM mutation.
- [ ] Test empty, large, overlapping, mixed-case, punctuation, and special-character term sets.

## DOM Traversal Tasks

- [ ] Use `TreeWalker` or `NodeIterator` over text nodes; never rewrite page `innerHTML`.
- [ ] Skip `a`, `button`, `input`, `textarea`, `select`, `option`, `code`, `pre`, and `contenteditable` ancestry.
- [ ] Skip script, style, hidden, disconnected, and extension-owned nodes.
- [ ] Split and wrap only the matched text ranges in each text node.
- [ ] Mark Salto wrappers so scans are idempotent.
- [ ] Provide deterministic cleanup that restores text without removing host listeners.

## Incremental Scanning Tasks

- [ ] Run one initial scan after document idle.
- [ ] Observe added nodes with `MutationObserver` and ignore mutations caused by Salto wrappers.
- [ ] Coalesce rapid mutations through a bounded queue.
- [ ] Process DOM writes in `requestAnimationFrame` batches.
- [ ] Yield between batches when supported and stop work when the content context is invalidated.
- [ ] Rescan or apply one term incrementally after a successful save without requiring page reload.
- [ ] Remove highlights when the setting is disabled.

## Performance Guardrails

- [ ] Define batch size and maximum work per frame with measured fixture results.
- [ ] Avoid scanning an unchanged whole document after every mutation.
- [ ] Avoid one regular expression with unbounded pathological behavior for very large term sets.
- [ ] Record scan duration, node count, and match count only in development diagnostics without capturing page text.
- [ ] Include a large static article and rapid infinite-scroll fixture in performance checks.

## Automated Verification

- [ ] Pure matcher tests cover all matching rules.
- [ ] DOM tests prove skipped elements remain untouched.
- [ ] DOM tests prove host element listeners survive highlighting and cleanup.
- [ ] Mutation tests cover added text, moved nodes, Salto mutations, and repeated observer delivery.
- [ ] Settings tests cover enable, disable, and re-enable.
- [ ] Save integration tests prove the newly saved term appears without reload.
- [ ] Performance fixtures assert bounded batches rather than fragile wall-clock timing alone.

## Manual Browser Acceptance

1. Open a long article containing repeated saved and unsaved terms.
2. Verify case-insensitive full-word matching and no substring false positives.
3. Verify links, form controls, editable content, and code blocks are untouched.
4. Append content dynamically and verify only new content is processed.
5. Save a new term and verify it appears without a page reload.
6. Disable highlighting and verify clean restoration of page text.
7. Scroll and type during a large scan and verify no noticeable interaction stall.

## Exit Criteria

- [ ] All PRD matching and skip rules are covered by tests.
- [ ] Initial and incremental scans are idempotent.
- [ ] Host DOM listeners and editing behavior remain intact.
- [ ] Large-page scans yield work and stay within defined batching limits.
- [ ] Full test, typecheck, and build commands pass.

## Non-Goals

- Cross-node phrase matching
- Lemmatization
- Highlight click cards or vocabulary management UI
- Server-assisted matching

## Rollback Boundary

The hardened scanner remains behind the same saved-term input and enable/disable boundary as the minimal scanner. It can be disabled without changing saved vocabulary data.

