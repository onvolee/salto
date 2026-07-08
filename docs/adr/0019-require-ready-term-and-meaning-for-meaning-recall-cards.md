# Require ready term and meaning for meaning-recall cards

Salto will generate `meaning-recall` cards only when both the term and meaning fields are ready. Vocabulary items with pending or failed meaning enrichment remain saved and retryable, but they do not enter the review queue as unusable cards. This keeps the learning module focused on reviewable material instead of carrying pending-card states caused by enrichment failures.
