# Track enrichment per field

Salto enrichment jobs and vocabulary field status will be tracked per field. Execution may batch dictionary-backed fields into one provider lookup or LLM-backed fields into one request, but persistence records success, failure, and retry state at the field level. This lets one failed field avoid blocking the vocabulary item, card generation, or retries for fields that already succeeded.
