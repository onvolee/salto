# Use Vocabulary names for syncable word data

Salto will name core syncable word records `VocabularyItem`, `VocabularyField`, and `VocabularyContext`, while keeping saved word as user-facing language for the save action. The vocabulary names make the data model suitable for browser extension and mobile learning clients, including short phrases and study workflows, instead of tying the core model to an extension-only saved-word collection. This reduces ambiguity before storage adapters and sync contracts are implemented.
