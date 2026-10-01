# Stale-page notes: an unticked clause naming a passed test, an agent's test excusing itself, phrases configurable (test/plugins/trackers/trackers.test.ts)

The gesture that proves it, step by step, and what a pass looks like.

## Result

What was seen, when, and by whom.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u12-evidence-rank

Result: pass. Gesture: the two stale-page tests in test/plugins/trackers/trackers.test.ts. Red first: before the code, both failed (no note emitted); the 'linked test' clause and the title-is-not-the-excuse cases were added later and also failed first (6 passed, 1 failed). Green after: 7 passed, 0 failed on Deno, Node and Bun, including excusePhrases set by the project and test-excuses-itself switched off. On this tracker: 0 stale clauses, 0 excuses (the one candidate, a passed test whose title says 'held by', is correctly not noted).
