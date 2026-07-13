# Selection Popup Panel Design

## Scope

Implement the first selection interaction surface for the Salto browser extension:

- Detect a valid text selection on a web page.
- Show a floating icon at the selection's upper-right edge.
- Open a panel only when the user clicks the icon.
- Allow the panel to be dragged from its header.
- Close the panel through its close button, `Escape`, or an ordinary click outside it.

This increment does not perform translation, call the background service worker, save vocabulary, or render content results. The panel includes an empty content region so later work can extend it without changing the interaction boundary.

## Existing Boundaries

The implementation follows the repository's existing architecture decisions:

- WXT owns the content-script entrypoint and lifecycle.
- React renders the extension-owned content UI.
- WXT `createShadowRootUi` isolates the UI from host-page styles.
- The content script owns text selection, floating trigger, panel placement, and page-level events.

## Components

### Content entrypoint

`entrypoints/content.tsx` creates a WXT Shadow Root UI, mounts one React root, and removes it when the content-script context is invalidated.

### SelectionPopupApp

The root component coordinates selection observation, interaction state, global close events, scrolling, resizing, and the captured selection session.

### Selection utilities

Selection utilities read `window.getSelection()` and return a snapshot containing:

- Trimmed selected text.
- A cloned `Range` retained for geometry calculations.
- The last non-empty client rectangle, used as the icon anchor for multi-line selections.

A valid selection is non-collapsed, contains non-whitespace text, and contains no more than 500 characters.

### Positioning utilities

Pure positioning functions calculate and constrain:

- The icon position relative to the selected text.
- The initial panel position relative to the icon.
- The panel position during dragging and viewport resizing.

These functions use viewport coordinates and keep the complete interactive surface within a small viewport margin.

### FloatingTrigger

The floating trigger is an icon-only button. It is visible only while the state is `trigger-visible`. It does not respond to hover by opening the panel. Clicking it opens the panel and hides the trigger.

### SelectionPanel

The panel contains:

- A header with a drag region.
- A visible bookmark button that intentionally has no behavior in this increment.
- A working close button.
- An empty content region reserved for future translation UI.

Only the header area outside interactive buttons can initiate dragging.

## Interaction State

The UI has three externally visible states:

### Hidden

There is no active trigger or panel. A new valid selection can transition the UI to `trigger-visible`.

### Trigger visible

The icon appears at the valid selection's upper-right edge.

- Clicking the icon transitions to `panel-open`.
- Scrolling recalculates the icon from the retained range so it continues to follow the selected text.
- Resizing recalculates and constrains the icon.
- A new valid selection replaces the previous trigger session and moves the icon to the new selection.
- An invalid or collapsed selection hides the trigger.

### Panel open

The icon is hidden and the panel opens near the icon's last position.

- The panel stays at the same viewport coordinates when the page scrolls.
- Resizing does not re-anchor the panel; it only constrains the existing position to the new viewport.
- Dragging changes the panel's viewport coordinates.
- Dragged position is retained only for the current open panel session.
- All selection changes are ignored by Salto while the panel remains open.
- A selection made while the panel is open does not move or close the panel, show an icon, or replace the selection data captured when the panel opened.

The panel closes when the user:

- Presses `Escape`.
- Activates the close button.
- Performs an ordinary click outside the panel.

Each of these close paths returns the UI to `hidden` and calls `Selection.removeAllRanges()` so the page returns to an unselected visual state. Closing does not restore the old trigger. A later valid selection is required to show another trigger.

## Outside Click And Selection Gestures

An outside text-selection drag is not treated as an ordinary outside click.

While the panel is open:

1. Salto observes the pointer gesture without changing panel state on pointer down.
2. If the gesture creates a non-collapsed selection, the subsequent outside click is suppressed as a close gesture.
3. The browser may display the newly selected text, but Salto ignores it and keeps the panel bound to its original captured selection data.
4. A later explicit close action clears whichever browser selection is currently visible.

An outside pointer interaction that does not form a selection remains an ordinary outside click and closes the panel.

## Dragging

Dragging uses Pointer Events and pointer capture.

- A primary-pointer press on the header's non-button area starts a drag.
- The initial pointer-to-panel offset is retained to prevent the panel from jumping.
- Pointer movement updates the panel position in viewport coordinates.
- Every update clamps the panel inside the viewport margin.
- Pointer up or pointer cancel ends the drag and releases capture.
- Pressing a header action button never starts a drag.
- Dragging the panel does not alter the browser selection.

## Accessibility

- Trigger, bookmark, and close controls are native buttons with accessible names.
- The bookmark control communicates that it is unavailable in this increment and performs no action.
- The panel is labelled as the selection panel without claiming unimplemented translation results.
- `Escape` closes the panel and clears the selection.
- Icon and header controls have visible keyboard focus states.
- Motion is direct and functional; no required animation is introduced.
- Colors and focus indicators target WCAG AA contrast.

## Cleanup And Failure Handling

- Event listeners use WXT content-script context helpers where possible so they are removed during invalidation.
- React is unmounted through the Shadow Root UI removal callback.
- Stale or detached ranges are treated as unavailable geometry; the trigger hides instead of throwing.
- If the viewport is smaller than the preferred panel size, responsive maximum dimensions keep the panel usable.
- The host page receives no extension CSS outside the WXT Shadow DOM.

## Verification

### Unit tests

- Reject collapsed, whitespace-only, and over-500-character selections.
- Choose the last non-empty rectangle for multi-line selections.
- Position the icon at the selection's upper-right edge.
- Place the initial panel near the icon and constrain it at every viewport edge.
- Clamp dragged and resized panel positions.

### Component interaction tests

- A valid selection shows the trigger.
- Hovering or focusing the trigger does not open the panel.
- Clicking the trigger hides it and opens the panel.
- Bookmark activation has no state-changing behavior.
- Only the non-button header region begins a drag.
- `Escape`, close-button activation, and an ordinary outside click close the panel and clear the browser selection.
- An outside selection drag does not close the panel or replace its captured session.
- Selection changes while the panel is open do not show a trigger or move the panel.

### Browser verification

- The trigger follows selected text during page scrolling.
- The open panel remains fixed relative to the viewport during page scrolling.
- Trigger and panel remain visible near all viewport edges.
- The panel can be dragged only by its header and cannot be moved outside the viewport.
- Shadow DOM styles remain consistent on pages with aggressive global CSS.

The final implementation must pass the extension typecheck, focused tests, full workspace tests, and production extension build.
