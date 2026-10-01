# Tests name their evidence rank and a regression test its red run; check notes a passed regression test with no red run, and one on inspection (test/plugins/trackers/trackers.test.ts)

The gesture that proves it, step by step, and what a pass looks like.

## Result

What was seen, when, and by whom.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u12-evidence-rank

Result: pass. Gesture: the trackers tests in test/plugins/trackers/trackers.test.ts ('a test names its evidence from the ranking...'). Red first: written before the code, they failed (deno: 4 passed, 3 failed; evidenceKind was 'not a field of tests'). Green after: 7 passed, 0 failed on Deno, Node and Bun. Evidence kind: observation (the runners' counts). On this tracker the new regression-test-saw-red note lists 35 passed regression tests with no redSeen, against 0 before the check existed.
