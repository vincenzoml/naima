# Naima's own tracker managed by a locked clone of itself

## Gesture

In a clone of Naima's repository: `deno task verify`, then `git -C naima-tracker/naima rev-parse HEAD` and `git status --porcelain --ignored`.

Pass: verify passes — typecheck, tests, `check` with the working tree, the reference current, and `check` through the launcher; the clone's HEAD is the `commit` in `naima-tracker/naima-data/naima.json`, cloned from this repository's own objects; git shows `naima-tracker/naima/` only as ignored.

## Result

2026-09-30, the author (agent), in the worktree of branch `distribution`: `deno task verify` passes, and the launcher cloned `naima-tracker/naima/` from the repository's own objects at the locked commit — `attachments/verify-2026-09-30.txt`. Not yet performed in a fresh clone by someone other than the author.

Then, after the merge and the push, `naima update` moved the lock from
`7a5ef46` to `068ace6`, the new `main`: the first update of Naima's own
tracker, by the same command every project uses. CI (`tests/suite-passes-deno-node-bun-ci`)
ran the same `verify` in a fresh checkout.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

Full suite pass on main's head (commit 623fd87af5526fccdf685f4d0825ac0e062b4509). deno task verify: 220/220 passed, 0 failed. node --test test/**/*.test.ts: 220/220 passed. bun test --timeout 30000 ./test/: 220/220 passed. Logs kept as evidence in the session scratchpad (verify-deno.log, node-test.log, bun-test.log).
