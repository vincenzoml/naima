# bun test ignores bunfig.toml's 30-second timeout: spawn-heavy init and update tests fail at 5 seconds under load

What happened, what was seen, and what is still open.

## Evidence

Attach screenshots and logs in attachments/.

## Notes

### 2026-10-01 — U11 implementer, on claude/u11-value-lists

Measured on claude/u11-value-lists after merging main, Bun 1.4.2, machine load average 8 to 12 from sibling worktrees: bun test ./test/ gave 249 pass / 4 fail, every failure an init or update test stopped at about 5.1 s (init strips credentials, init's next step, second clone aligns, naima update pulls). The same tree with bun test --timeout 30000 ./test/ gave 253/0. So the [test] timeout = 30000 in bunfig.toml is not reaching these tests (they are node:test style); the earlier fix (bugs/bun-s-5-second-default-test-timeout) does not hold under load.

### 2026-10-01 — Vincenzo Ciancia, on claude/f-u1-bun

U1 implementer, on claude/f-u1-bun: checked whether the file-bun-timeout fix (commit 9968ca0, merged to main 2026-10-01, per-test timeout overrides in test/init.test.ts and test/distribution.test.ts) already resolves this. It does: plain 'bun test ./test/' under artificial load (20 background 'yes' processes, load average 8.4 to 36.0) gave 356 pass / 1 skip / 0 fail in 118s, no sign of the ~5s node:test-style timeout this bug reports. Nothing left to fix; closing out with proof tests/plain-bun-test-test-passes-under-load.

### 2026-10-01 — triage agent, on claude/effort-triage

Read the item's notes and commit 9968ca0 (test/init.test.ts, test/distribution.test.ts): per-test timeout overrides, a small and already-shipped fix.

### 2026-10-01 — Vincenzo Ciancia, on claude/final-sweep

Measured in the final sweep (claude/final-sweep, 2026-10-01): plain bun test ./test/ run alongside deno task verify, node --test and another worktree's verify gave 4 failures at about 5.2 s, all in test/launcher.test.ts (allow-listed environment, init --write-excludes, init --write-agent-pointer, ui on loopback): the per-test overrides of 9968ca0 do not cover the launcher tests. Run alone it gave 363 pass, 0 fail. The evidence owner should weigh this against tests/plain-bun-test-test-passes-under-load before closing.
