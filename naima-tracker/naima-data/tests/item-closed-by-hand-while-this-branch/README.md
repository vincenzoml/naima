# An item closed by hand while this branch claims it fails naima check (test/plugins/coordination/coordination.test.ts)

The gesture that proves it, step by step, and what a pass looks like.

## Result

What was seen, when, and by whom.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u10-proof-integrity

Result: pass. Gesture: the coordination test claims an item on a branch, moves its directory into a non-creatable archive type and rewrites meta.json by hand, then runs the checks: the new closed-not-claimed check reports it as a problem; after naima release the checks are clean. Red before the check existed (no problem reported), green after it. Deno, Node and Bun.
