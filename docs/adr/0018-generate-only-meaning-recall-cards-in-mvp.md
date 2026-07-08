# Generate only meaning-recall cards in MVP

Salto MVP will generate only `meaning-recall` learning cards, where the user sees the term and recalls its meaning. Other card types such as reverse recall, spelling, cloze, audio, synonym, and word-form cards are deferred. This keeps the learning loop small while preserving `LearningCard.cardType` as the extension point for future study modes.
