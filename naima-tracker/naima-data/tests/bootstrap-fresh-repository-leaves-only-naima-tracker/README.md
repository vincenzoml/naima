# Bootstrap in a fresh repository leaves only naima-tracker/, with naima/ ignored

## Gesture

In a fresh git repository with a README and a commit: `git clone <Naima> naima-tracker/naima`, `deno run -A naima-tracker/naima/naima.ts init`, then, from a subdirectory, `naima new bugs "Export drops alpha"` and `naima check`; then `git status --porcelain --untracked-files=all` and `--ignored`.

Pass: every step exits 0; `git status` lists only `naima-tracker/.gitignore`, `naima-tracker/README.md` and files under `naima-tracker/naima-data/`, and `naima-tracker/naima/` only as ignored; `naima.json` is `{ format, source, commit, carry: "clone" }` with the clone's origin and HEAD; the project's README is byte-for-byte unchanged.

## Result

2026-09-30, the author (agent), automated by `src/distribution.test.ts` ("bootstrap, init, new, check"): passes on Deno 2.9.7, Node 26.5.0 and Bun 1.4.2, 57 tests each — the feature's attachments `tests-deno-2026-09-30.txt`, `tests-node-2026-09-30.txt` and `tests-bun-2026-09-30.txt`, in `features/deno-distribution-one-global-install-naima-tracker/attachments/`. Not yet performed by someone other than the author.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

Full suite pass on main's head (commit 623fd87af5526fccdf685f4d0825ac0e062b4509). deno task verify: 220/220 passed, 0 failed. node --test test/**/*.test.ts: 220/220 passed. bun test --timeout 30000 ./test/: 220/220 passed. Logs kept as evidence in the session scratchpad (verify-deno.log, node-test.log, bun-test.log).
