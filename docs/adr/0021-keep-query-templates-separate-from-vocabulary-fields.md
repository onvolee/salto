# Keep query templates separate from vocabulary fields

Salto query templates remain user-editable schemas for reading-time translation panel output, but they do not define or create syncable vocabulary fields. Vocabulary fields are fixed learning data, while query-template fields are extension-local translation UI configuration. This preserves flexible reading assistance without making every custom prompt field part of the long-term vocabulary and mobile sync contract.
