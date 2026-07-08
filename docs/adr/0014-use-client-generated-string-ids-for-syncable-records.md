# Use client-generated string IDs for syncable records

Salto syncable records will use client-generated string identifiers rather than database auto-increment IDs. Stable derived records, such as vocabulary fields, contexts, learning cards, and learning states, should use deterministic IDs when the natural identity is stable; review logs should use unique event IDs because each review is a separate event. This supports offline browser extension and mobile clients without requiring a server round trip before records can be created.
