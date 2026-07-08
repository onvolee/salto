# Keep vocabulary field values read-only in MVP

Salto MVP will not allow users to edit vocabulary field values. Vocabulary fields are populated by system, dictionary, or LLM enrichment flows and remain read-only in v0.1. This avoids user-overwrite semantics, enrichment overwrite rules, and sync conflict handling until editing becomes a deliberate product feature.
