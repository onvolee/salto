# Support one active OpenAI-compatible LLM config

Salto MVP will support one active OpenAI-compatible LLM configuration stored as extension-local settings. The background service worker owns LLM requests and API-key access through an `LlmClient` adapter boundary. Multiple provider profiles, per-template model selection, fallback providers, and cost tracking are deferred until the single-provider flow is proven.
