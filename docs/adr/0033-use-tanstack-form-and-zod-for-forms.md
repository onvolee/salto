# Use TanStack Form and Zod for form handling

Salto will use @tanstack/react-form + zod for form handling in the options page (template management, field editing, extension settings).

This replaces the current hand-rolled useState + manual validation approach used in the MVP v0.1 options page.

TanStack Form + zod was chosen because:
- Type-safe form state with automatic validation derived from zod schemas
- Reduces boilerplate for complex forms (template field editing has multiple conditional fields)
- zod schemas can be shared between core (domain validation) and extension (form validation)
- TanStack Form is framework-agnostic at its core, aligns with the headless/composable approach already used (shadcn/ui, @base-ui/react)

The existing `useOptionsSettings` hook pattern will be refactored to use TanStack Form for template and settings forms. Simple forms (like the LLM config form) may continue using useState if they remain trivial.
