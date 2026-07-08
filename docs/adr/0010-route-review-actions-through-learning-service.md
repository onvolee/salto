# Route review actions through LearningService

Salto review actions will be handled through a shared `LearningService` and `Scheduler` boundary instead of letting UI components or storage adapters directly mutate `LearningState` and `ReviewLog`. The service records the review event, calculates the next learning state, and persists both changes through a repository transaction. This keeps browser extension and mobile review behavior consistent, allows scheduler replacement later, and prevents Dexie or SQLite implementations from owning learning semantics.
