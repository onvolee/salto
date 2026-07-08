# Keep domain models storage-adapter neutral

Salto MVP v0.1 will use Dexie as the browser-extension IndexedDB adapter, but domain models, service contracts, and future sync DTOs must remain platform independent. A future mobile app is expected to use React Native or Expo with SQLite, so extension code must not let Dexie table shapes leak into core saved-word, query-template, or sync semantics. This keeps the MVP local-first without choosing a browser-only data model that would be expensive to unwind later.
