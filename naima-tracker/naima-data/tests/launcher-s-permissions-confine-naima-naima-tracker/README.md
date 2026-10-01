# The launcher's permissions confine Naima to naima-tracker/ and git

## Gesture

Through the launcher, run a fork whose plugin writes a file inside the data directory, writes a file at the project root, and runs `ls`.

Pass: the write inside succeeds; the write outside exits 2 with Deno's `Requires write access to "…/escaped.txt", run again with the --allow-write flag` and no file appears; the run exits 2 with `Requires run access to "ls", run again with the --allow-run flag`.

## Result

2026-09-30, the author (agent), automated by `src/distribution.test.ts` ("under the launcher's permissions"): passes on Deno 2.9.7, Node 26.5.0 and Bun 1.4.2, 57 tests each — the feature's attachments `tests-deno-2026-09-30.txt`, `tests-node-2026-09-30.txt` and `tests-bun-2026-09-30.txt`, in `features/deno-distribution-one-global-install-naima-tracker/attachments/`. Not yet performed by someone other than the author.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

Full suite pass on main's head (commit 623fd87af5526fccdf685f4d0825ac0e062b4509). deno task verify: 220/220 passed, 0 failed. node --test test/**/*.test.ts: 220/220 passed. bun test --timeout 30000 ./test/: 220/220 passed. Logs kept as evidence in the session scratchpad (verify-deno.log, node-test.log, bun-test.log).
