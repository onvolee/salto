# Use @dnd-kit for drag-and-drop interactions

Salto will use @dnd-kit/core + @dnd-kit/sortable for drag-and-drop interactions, specifically for template field reordering in the options page.

@dnd-kit was chosen over custom pointer-event drag logic (currently used for the selection panel) because:
- Mature, lightweight (~12KB gzipped), actively maintained
- Built-in keyboard accessibility (Tab, Arrow keys, Space/Enter) — critical for field reordering
- React 19 compatible, works with the existing shadcn/ui + Tailwind stack
- Sortable preset handles the exact use case (vertical list reordering) with minimal boilerplate

Custom pointer-event drag remains acceptable for simple one-off cases (like panel dragging) where keyboard accessibility is not required.
