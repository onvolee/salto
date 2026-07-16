# Append deduplicated vocabulary contexts

Salto will keep one `VocabularyItem` per `canonicalKey`, but repeated saves can append deduplicated `VocabularyContext` records when the user encounters the same vocabulary item in a new reading context. This preserves real reading examples for future card generation and review without turning repeated saves into duplicate vocabulary entries. Context deduplication uses the vocabulary item ID, normalized page URL, and normalized sentence context rather than canonical-key foreign keys or blind append behavior.
