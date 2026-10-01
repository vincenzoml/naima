# An epic's status set by hand against its items fails naima check (test/plugins/epics/epics.test.ts)

The gesture that proves it, step by step, and what a pass looks like.

## Result

What was seen, when, and by whom.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u10-proof-integrity

Result: pass. Gesture: the epics test writes status done into an epic's meta.json while its one item is open, reloads and runs the checks: the epics check reports the epic's status against what its items give it. Red before the check (no problem reported), green after. Deno, Node and Bun.
