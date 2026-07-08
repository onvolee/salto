# Use a lightweight pnpm monorepo

Salto will start as a pnpm workspace with `apps/extension` for the WXT browser extension and `packages/core` for platform-independent domain models, schemas, service contracts, and sync DTOs. The mobile app, sync server, and shared UI packages are deferred, but the initial structure must prevent WXT, Dexie, and browser-extension concerns from leaking into core concepts that a future Expo SQLite mobile app will consume. This adds a small amount of workspace overhead now to avoid a much larger extraction later.
