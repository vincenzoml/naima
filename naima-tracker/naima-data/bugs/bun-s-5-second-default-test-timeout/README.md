# Bun's 5-second default test timeout can fail the dist tests under load

Seen on 2026-10-01 on branch claude/runtime-folder: `bun test ./test/` run
right after `node --test` failed 2 of 195 tests in `test/dist.test.ts`. Both
were stopped by Bun's default 5000 ms timeout, and the git child process was
killed (`git -c: git failed`). The same command rerun at once passed 195 of
195. The tests copy the repository and build dist commits, which take about
5 s each when the machine is loaded.

The gesture that proves a fix: run `bun test ./test/` three times in a row,
with another test run going at the same time. Every run passes.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u8-papercuts

Fixed: added bunfig.toml at the repo root with [test] timeout = 30000, a project-wide default so Bun's own 5000ms per-test default stops being the limit for any slow test (dist.test.ts's dist-build and dist-world tests, init.test.ts's three-init test, site.test.ts's install.sh test, and distribution.test.ts's carry round-trip test were all seen timing out under concurrent load today). Also added an explicit { timeout: 30_000 } on the specific tests named in the bug report and in init.test.ts/site.test.ts, which documents them as known-slow and keeps Node's test runner (which has no low default and ignores bunfig.toml) explicit too. Proof: bun test ./test/ (no --timeout flag) run three times with another run going at the same time, all green — logs in the session scratchpad.

### 2026-10-01 — Vincenzo Ciancia, on claude/no-dist

ci.yml now runs bun test --timeout 30000 ./test/, the flag the local gates use, besides the per-test timeouts (claude/no-dist).

### 2026-10-01 — Vincenzo Ciancia, on claude/no-dist

ci.yml is removed (owner's decision, 2026-10-01); the note above no longer applies. The gate is local: bun test --timeout 30000 ./test/, in AGENTS.md.

### 2026-10-01 — Vincenzo Ciancia, on claude/u10-proof-integrity

Seen again on claude/u10-proof-integrity under load (load average 9-13, sibling workers running gates): bun test ./test/ failed 17, then 9, of 252, and test/init.test.ts alone failed 3 of 4, each at 5-6 seconds, git killed mid-clone (git failed, no stderr; Bun reports a dangling process killed) although bunfig.toml sets timeout = 30000. bun test --timeout 30000 ./test/ on the same tree: 252/0. So Bun 1.4.2 does not apply the bunfig.toml test timeout to these tests; the flag does.
