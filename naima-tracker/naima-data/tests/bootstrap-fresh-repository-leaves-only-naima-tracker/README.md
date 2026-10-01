# Bootstrap in a fresh repository leaves only naima-tracker/, with naima/ ignored

## Gesture

In a fresh git repository with a README and a commit: `git clone <Naima> naima-tracker/naima`, `deno run -A naima-tracker/naima/naima.ts init`, then, from a subdirectory, `naima new bugs "Export drops alpha"` and `naima check`; then `git status --porcelain --untracked-files=all` and `--ignored`.

Pass: every step exits 0; `git status` lists only `naima-tracker/.gitignore`, `naima-tracker/README.md` and files under `naima-tracker/naima-data/`, and `naima-tracker/naima/` only as ignored; `naima.json` is `{ format, source, commit, carry: "clone" }` with the clone's origin and HEAD; the project's README is byte-for-byte unchanged.

## Result

2026-09-30, the author (agent), automated by `src/distribution.test.ts` ("bootstrap, init, new, check"): passes on Deno 2.9.7, Node 26.5.0 and Bun 1.4.2, 57 tests each — the feature's attachments `tests-deno-2026-09-30.txt`, `tests-node-2026-09-30.txt` and `tests-bun-2026-09-30.txt`, in `features/deno-distribution-one-global-install-naima-tracker/attachments/`. Not yet performed by someone other than the author.
