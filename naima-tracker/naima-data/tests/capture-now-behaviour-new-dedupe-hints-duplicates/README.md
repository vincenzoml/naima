# Capture-now behaviour: new --dedupe hints duplicates and still writes; skill and reporting-and-triage state it as always-on; rule filed

Ran `node --test "test/**/*.test.ts"`: 248 passed, 0 failed, including the new
test/core/core.test.ts case "new --dedupe prints likely duplicates of the same
type before writing, and still writes" — it asserts the hint line and the
duplicate's title appear before the write, that the item count still grows by
one, and that a plain `new` (no --dedupe) prints only its usual one line.

Also ran `deno task verify` (typecheck, lint, fmt, tests, docs check, naima
check): clean, except one pre-existing note naming a sibling worktree
(claude/d2-people-docs) with no claim, unrelated to this branch.

`bun test ./test/` passes test/core/core.test.ts (32/32, including the new
case); eight failures are all in test/init.test.ts and test/dist.test.ts,
timing out on git subprocesses under bun in this sandbox — pre-existing and
unrelated to this change (same class as the "Bun timeout flake" the session
note of 2026-10-01, commit 624af8d, already named).
