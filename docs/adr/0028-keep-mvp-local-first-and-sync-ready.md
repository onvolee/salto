# Keep MVP local-first and sync-ready

Salto MVP will not implement accounts, cloud sync, sync APIs, or mobile clients. It will remain local-first while preserving sync-ready data shapes such as client-generated IDs, soft deletion, version metadata, vocabulary records, learning state, and review logs. This keeps the browser-extension learning loop focused while avoiding local-only storage decisions that would make future mobile sync expensive.
