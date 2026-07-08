# Keep LLM API keys in background-owned request paths

Salto MVP will store the user's OpenAI-compatible API key in extension-local storage and use it only from background-owned request paths. Options UI may collect or update the key, but content scripts must never receive, cache, or display it through messaging. This keeps external LLM requests and secret access behind the same background boundary used for enrichment and translation execution.
