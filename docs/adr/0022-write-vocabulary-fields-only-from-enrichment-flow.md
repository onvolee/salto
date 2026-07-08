# Write vocabulary fields only from enrichment flow

Salto will treat translation panel results as transient reading output and will not write them directly into syncable vocabulary fields. Saving a word creates or reuses vocabulary records and then runs the fixed enrichment flow to populate vocabulary fields according to the vocabulary schema. This keeps long-term learning data stable even though query templates are customizable and translation-panel output can vary by prompt.
