---
name: Salto Extension
description: Compact reading-time translation UI for Chrome extension surfaces.
colors:
  surface: "oklch(1 0 0)"
  surface-subtle: "oklch(0.976 0.007 240)"
  foreground: "oklch(0.2 0.015 240)"
  primary: "oklch(0.588 0.158 241.966)"
  primary-foreground: "oklch(0.985 0.01 237.3)"
  muted: "oklch(0.951 0.018 237)"
  muted-foreground: "oklch(0.49 0.035 240)"
  border: "oklch(0.86 0.025 238)"
  ring: "oklch(0.65 0.15 239)"
  destructive: "oklch(0.577 0.245 27.325)"
typography:
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.625
    letterSpacing: "0"
rounded:
  sm: "4px"
  md: "6px"
  panel: "8px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    height: "28px"
    padding: "0 8px"
    typography: "{typography.label}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
    height: "28px"
    width: "28px"
    typography: "{typography.label}"
  floating-trigger:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.pill}"
    height: "32px"
    width: "32px"
  selection-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.panel}"
    width: "min(360px, calc(100vw - 16px))"
    height: "min(220px, calc(100vh - 16px))"
---

# Design System: Salto Extension

## 1. Overview

**Creative North Star: "The Quiet Marginal Note"**

Salto's extension UI should feel like a precise note that appears beside the text, not a separate application arriving on top of the page. The visual system is compact, restrained, and native to a productivity tool: white panels, cool-blue action color, crisp borders, small controls, and short state transitions.

The interface must preserve reading flow. Surfaces should be legible above arbitrary web pages, but never ornamental enough to compete with the page being read. The system explicitly rejects gradient-led visual styling, decorative color washes, AI-SaaS-style gradient cards, over-rounded components, and large modal workflows.

**Key Characteristics:**
- Compact density with stable dimensions for floating controls.
- Restrained color: blue means primary action, focus, or selected state.
- System sans typography only; no display type in task UI.
- Clear focus, disabled, hover, and active states on every control.

## 2. Colors

The palette is a restrained cool-neutral product palette with one blue action color and tonal layering for panels.

### Primary
- **Reading Blue** (`primary`): Used for primary actions, the floating selection trigger, focus emphasis, and active states. It should remain rare enough that users immediately understand what can be acted on.
- **On Blue** (`primary-foreground`): Text or icon color on Reading Blue.

### Neutral
- **Page White** (`surface`): Default panel and popover surface.
- **Cool Header** (`surface-subtle`): Header, toolbar, and quiet secondary panel surface.
- **Ink** (`foreground`): Primary text and icon color.
- **Soft Fill** (`muted`): Hover backgrounds and inactive tonal controls.
- **Quiet Ink** (`muted-foreground`): Secondary text and disabled action color. Keep contrast AA-compliant on the surfaces where it appears.
- **Cool Border** (`border`): Panel borders, header dividers, grip affordances, and outline buttons.
- **Focus Blue** (`ring`): Keyboard focus ring and emphasized focus state.

### Tertiary
- **Failure Red** (`destructive`): Error and destructive state color only.

### Named Rules

**The One Accent Rule.** Reading Blue is the only brand accent on extension UI; do not add decorative hues to translation panels or saved-word controls.

**The Above Any Page Rule.** Foreground panels must maintain strong contrast against arbitrary web pages; if a page background fights the panel, strengthen the panel border or shadow before adding decoration.

## 3. Typography

**Display Font:** None.
**Body Font:** System sans stack (`ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`).
**Label/Mono Font:** System sans stack.

**Character:** Typography should be quiet, functional, and compact. Salto is an in-reading tool, so labels and body copy must read quickly at small sizes without stylized display treatment.

### Hierarchy
- **Headline** (600, `0.875rem`, 1.25): Small panel headings and option section labels when needed.
- **Title** (600, `0.8125rem`, 1.3): Compact component titles and saved-word labels.
- **Body** (400, `0.75rem`, 1.5): Translation output, explanatory text, and compact prose. Cap longer prose at 65-75ch.
- **Label** (500, `0.75rem`, 1.625): Buttons, controls, metadata, and status labels.
- **Micro Label** (500, `0.625rem`, 1.5): Tiny affordances and dense metadata only.

### Named Rules

**The No Display Type Rule.** Product UI labels, buttons, and floating panels always use the system sans stack; display fonts are forbidden in extension surfaces.

## 4. Elevation

Salto uses a hybrid of crisp borders and short, low-blur shadows. Depth should prove that a floating surface is above the web page, not decorate it. Static panels use a 1px cool border plus a restrained shadow; interactive triggers may lift by 1px on hover.

### Shadow Vocabulary
- **Panel Shadow** (`0 4px 8px oklch(0.2 0.03 240 / 0.2)`): Selection panel elevation over web pages.
- **Trigger Shadow** (`0 3px 8px oklch(0.2 0.03 240 / 0.24)`): Floating trigger at rest.
- **Trigger Hover Shadow** (`0 4px 8px oklch(0.2 0.03 240 / 0.28)`): Floating trigger hover state only.

### Named Rules

**The Purposeful Lift Rule.** Shadows exist to separate extension UI from page content. Do not use wide soft shadows as decoration.

## 5. Components

### Buttons
- **Shape:** Restrained rectangular controls with gently curved edges (`6px` default, `4px` for extra-small controls, full pill only for the circular floating trigger).
- **Primary:** Reading Blue background with On Blue text; compact height (`28px`) and horizontal padding (`8px`).
- **Ghost:** Transparent by default, Quiet Ink text, Soft Fill hover background, Ink hover text.
- **Hover / Focus:** Hover changes color or tonal fill; keyboard focus uses a 2px Focus Blue outline/ring. Active button presses may translate down by 1px.
- **Disabled:** Disabled controls keep shape but reduce opacity and remove pointer interaction. Disabled icon buttons may use Quiet Ink at lower opacity.

### Cards / Containers
- **Corner Style:** Panels use an 8px radius. Do not exceed 12px on extension cards or panels.
- **Background:** Page White for content, Cool Header for draggable headers and toolbar bands.
- **Shadow Strategy:** Use Panel Shadow only for floating surfaces. Static options-page containers should prefer border and tonal layering.
- **Border:** Cool Border at 1px for panel edges and dividers.
- **Internal Padding:** Compact scale: `8px` for control groups, `12px` for panel horizontal padding, `16px` only when a larger options surface needs breathing room.

### Inputs / Fields
- **Style:** Use 1px Cool Border, Page White background, 6px radius, compact vertical padding.
- **Focus:** Shift to Focus Blue ring, not a heavy colored fill.
- **Error / Disabled:** Failure Red for error border/ring; disabled states reduce opacity without changing geometry.

### Navigation
- **Style:** Extension navigation should use familiar product patterns: tabs, compact lists, or toolbar groups. Active state may use Reading Blue text or a subtle Soft Fill background, not a saturated inactive treatment.

### Selection Panel
- **Style:** Fixed-position dialog with Page White body, Cool Header drag area, centered grip, and right-aligned icon actions.
- **Behavior:** Must remain usable near viewport edges, support keyboard dismissal, and preserve the user's page selection until a deliberate close.

### Floating Trigger
- **Style:** A 32px circular Reading Blue icon button with short hover lift. The pill radius is reserved for this trigger and should not spread to panels or cards.
- **Behavior:** Appears near the selected range and should feel temporary, not like persistent page chrome.

## 6. Do's and Don'ts

### Do:
- **Do** preserve the reading flow; every panel should help the user understand or save selected text without pulling attention away for longer than necessary.
- **Do** use Reading Blue for primary action, focus, selected, or active states only.
- **Do** keep extension panels compact, with stable viewport-aware dimensions and restrained 8px panel radii.
- **Do** make saved, loading, failed, enriched, ready, and retry states visible and unambiguous.
- **Do** provide hover, focus-visible, active, disabled, loading, and error treatments for interactive components.

### Don't:
- **Don't** use gradient-led visual styling, decorative color washes, or AI-SaaS-style gradient cards.
- **Don't** use excessively rounded components; buttons, panels, settings controls, and learning cards must feel native to a compact productivity tool.
- **Don't** interrupt reading with large modal workflows when an inline or floating panel can do the job.
- **Don't** over-gamify vocabulary learning or make simple translation/save actions feel like a separate study session.
- **Don't** introduce decorative motion that does not communicate state.
