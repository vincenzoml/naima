# A test's commit starts no background maintenance, so a clone right after it finds every object (test/core/git.test.ts, on Deno, Node and Bun)

## Gesture

`deno test -A test/core/git.test.ts --filter maintenance`, then the full suite under Node and Bun. The test "a test's commit starts no background maintenance, so a local clone right after it finds every object" configures a repository to run maintenance in the foreground after every commit, commits 20 files through `gitIn` (`test/core/testing.ts`) and clones at once: every object must still be loose (`packs: 0`) and the clone must hold the commit.

Pass: green on Deno, Node and Bun.

## Result

2026-10-01, final sweep (claude/final-sweep). Red: with `-c maintenance.auto=false -c gc.auto=0` removed from `gitIn`'s identity, the test fails on Deno ("no maintenance packed them"). Green: restored, it passes on Deno, Node and Bun (the full gates of the sweep).
