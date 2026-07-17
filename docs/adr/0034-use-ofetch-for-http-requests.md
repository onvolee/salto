# Use ofetch for HTTP requests

Salto will use ofetch for HTTP requests in dictionary adapters and any future HTTP client needs.

ofetch was chosen over raw fetch API (currently used for LLM requests) because:
- Automatic retry with configurable backoff — critical for dictionary adapters hitting external sites
- Built-in timeout support — dictionary lookups must fail fast to avoid blocking the enrichment queue
- Better error handling and JSON parsing out of the box
- Lightweight (~3KB), works in both browser and Node.js environments
- Compatible with the existing background-owned request pattern (API keys stay in background)

The existing LLM client using raw fetch may be migrated to ofetch for consistency, but this is not required for MVP.
