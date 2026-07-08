# Use an FSRS-compatible learning state shape

Salto MVP may start with a simple review scheduler, but learning state and review logs will use an FSRS-compatible shape: user ratings are `again`, `hard`, `good`, and `easy`, and card state keeps fields such as due time, stability, difficulty, scheduled interval, review count, lapse count, state, and last review time. This does not require implementing FSRS in v0.1, but it avoids locking sync data to coarse fields like `mastery` and `nextReviewAt` that would be hard to migrate once browser extension and mobile clients both review cards.
