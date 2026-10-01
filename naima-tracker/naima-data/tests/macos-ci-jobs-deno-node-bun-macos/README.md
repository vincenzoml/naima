# The macOS CI jobs (deno, node, bun on macos-15) pass on the branch's head, and the dist job runs

The gesture that proves it, step by step, and what a pass looks like.

1. Push the commit carrying the fix (the branch, or its fast-forward onto main).
2. Open its GitHub Actions run on github.com/vincenzoml/naima
   (`gh run list -R vincenzoml/naima --commit <sha>`, then `gh run view <id>`).
3. Pass: the jobs `deno (macos-15)`, `node (macos-15)` and `bun (macos-15)` are
   green, with no "failed to copy file to '…/objects/…'" in their logs; on a push
   to main, the `dist` job runs instead of being skipped.
4. Negative half: the regression test "a test's commit starts no background
   maintenance…" (src/core/git.test.ts) fails when the two maintenance flags are
   removed from `gitIn` (src/core/testing.ts) — measured locally on Deno.

## Result

What was seen, when, and by whom.
