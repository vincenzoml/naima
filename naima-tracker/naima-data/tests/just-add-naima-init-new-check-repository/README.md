# Just add naima: init, new, check in a repository outside Naima leave only naima/

## Gesture

1. In a fresh git repository outside Naima's directory, with a README and a
   commit, run Naima from wherever it is installed: `naima init`, then, from a
   subdirectory, `naima new bugs "Export drops alpha"` and `naima check`.
2. `git status --porcelain --ignored` in the host.
3. `naima init` again.

Pass: step 1 exits 0 each time and `check` holds; step 2 prints exactly
`?? naima/` (nothing else added, nothing ignored written: no cache, no
`node_modules`); the README is byte-for-byte unchanged; step 3 changes
nothing. `src/cli.test.ts` ("just add naima") automates this; this item is
the check that it holds for someone other than the author.

## Result

2026-09-30, the author (agent), automated and by hand, working tree at v0.2.0:
both pass. `attachments/e2e-2026-09-30.txt` (the test run),
`attachments/host-footprint-2026-09-30.txt` (the host's `git status` is
`?? naima/`; `naima/` holds `config.json` and the one item). Not yet
performed by someone other than the author.

## Withdrawn, 2026-09-30

The layout it proves, a top-level `naima/` directory, was replaced by `naima-tracker/` (the Deno distribution feature). Its successor is `tests/bootstrap-fresh-repository-leaves-only-naima-tracker`.
