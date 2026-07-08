# Generate learning cards from enriched vocabulary

Saving a selection will create or reuse vocabulary records and capture reading context, but it will not directly create complete learning cards. Learning cards are generated or refreshed by the learning module from enriched vocabulary fields and card-generation rules, then scheduled through learning state and review logs. This keeps reading-time saving fast and lets browser extension and mobile clients share the same study semantics without tying card creation to the content-script save action.
