# Store review events and learning state separately

Salto will store `ReviewLog` as append-only review events and `LearningState` as the current scheduling and memory state for each learning card. This avoids hiding review history inside a mutable word or card record, supports multi-client sync with offline review events, and leaves room to recalculate state if the review algorithm changes. Storing only `mastery` or `nextReviewAt` on a word would be simpler but too coarse for cross-device learning.
