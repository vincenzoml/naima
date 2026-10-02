# A code measure reads a git submodule's files: the working tree, a historical gitlink, and a missing commit counted as zero (test/plugins/metrics/code.test.ts, on Deno, Node and Bun)

The gesture that proves it, step by step, and what a pass looks like.

## Result

What was seen, when, and by whom.

## Notes

### 2026-10-02 — agent, on claude/split-metrics

node --test test/plugins/metrics/code.test.ts: 10/10 passed (perl alarm 300). Reverting the fix in code.ts and rerunning the same file reproduced 1 failing assertion ('the submodule's file is listed') — red before, green after. Full suite, commit 77447e1bbc124f71cdb490537d9514ce61be83f6: deno task verify (alarm 900) — all invariants hold, 0 lint/format problems; node --test "test/**/*.test.ts" (alarm 900) — 388/388 passed; bun test ./test/ (alarm 900, run alone) — 388/388 passed. Logs under scratchpad/split-metrics/ in the session's private tmp.
