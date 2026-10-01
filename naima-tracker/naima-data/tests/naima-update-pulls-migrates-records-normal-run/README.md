# naima update pulls, migrates and records; a normal run never pulls

## Gesture

With the source's main moved to a commit that carries a format migration: `naima check`, then `naima update --check`, `naima update`, `naima check`, and `naima update` again.

Pass: the first `check` leaves the program and `origin/main` in the clone at the lock (nothing fetched); `update --check` exits 1 saying main moved; `update` prints the lock moving and the data migrated from format 1 to 2, and leaves `naima.json` at the new commit and format with every item migrated; afterwards `check` and `update --check` exit 0 and `update` has nothing to migrate.

## Result

2026-09-30, the author (agent), automated by `src/distribution.test.ts` ("naima update pulls, migrates and records"): passes on Deno 2.9.7, Node 26.5.0 and Bun 1.4.2, 57 tests each — the feature's attachments `tests-deno-2026-09-30.txt`, `tests-node-2026-09-30.txt` and `tests-bun-2026-09-30.txt`, in `features/deno-distribution-one-global-install-naima-tracker/attachments/`. Not yet performed by someone other than the author.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

Full suite pass on main's head (commit 623fd87af5526fccdf685f4d0825ac0e062b4509). deno task verify: 220/220 passed, 0 failed. node --test test/**/*.test.ts: 220/220 passed. bun test --timeout 30000 ./test/: 220/220 passed. Logs kept as evidence in the session scratchpad (verify-deno.log, node-test.log, bun-test.log).
