# naima carry round-trips clone, vendored, submodule, clone

## Gesture

From a committed clone-mode host: `naima carry vendored`, commit, `naima check`; `naima carry submodule`, commit, `naima check`; `naima carry clone`, commit, `naima check`.

Pass: each switch is staged whole (the tree is clean after one commit) and `check` passes; vendored, the program is committed with no `.git` and no `.gitignore` line; as a submodule, the index holds a gitlink at the locked commit and `.gitmodules` names `naima-tracker/naima`; back to a clone, `.gitmodules` is gone, `.gitignore` is `/naima/` and nothing under `naima/` is tracked; in every mode the program's code is the locked commit's.

## Result

2026-09-30, the author (agent), automated by `src/distribution.test.ts` ("naima carry round-trips"): passes on Deno 2.9.7, Node 26.5.0 and Bun 1.4.2, 57 tests each — the feature's attachments `tests-deno-2026-09-30.txt`, `tests-node-2026-09-30.txt` and `tests-bun-2026-09-30.txt`, in `features/deno-distribution-one-global-install-naima-tracker/attachments/`. Not yet performed by someone other than the author.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

Full suite pass on main's head (commit 623fd87af5526fccdf685f4d0825ac0e062b4509). deno task verify: 220/220 passed, 0 failed. node --test test/**/*.test.ts: 220/220 passed. bun test --timeout 30000 ./test/: 220/220 passed. Logs kept as evidence in the session scratchpad (verify-deno.log, node-test.log, bun-test.log).
