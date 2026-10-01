# Renaming an item through naima set rewrites its page's title line in the same write (test/core/core.test.ts)

The gesture that proves it, step by step, and what a pass looks like.

## Result

What was seen, when, and by whom.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u8-papercuts

Result: pass. Gesture: test/core/core.test.ts asserts naima set <item> title="…" rewrites README.md's "# " line in the same write, and that a set touching no title leaves the page untouched. Red on the old code (title line kept the old title), green after the fix in naima/src/core/base.ts's setFields (routes a title change through saveProse with the rewritten title line, one write, through every plugin's write hooks). Full suite: deno task verify, node --test (241/0), bun test (241/0).
