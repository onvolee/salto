# Use background as the data and request boundary

Salto will route persistent writes, LLM requests, dictionary requests, and enrichment jobs through the extension background service worker. Content scripts own page interaction and isolated UI, while options pages edit configuration through shared service or messaging boundaries instead of scattering IndexedDB writes. This keeps API keys, external requests, and saved-word mutation rules in one place even though direct Dexie access from content scripts would be simpler.
