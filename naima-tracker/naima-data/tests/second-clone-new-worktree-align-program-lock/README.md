# A second clone and a new worktree align the program to the lock

## Gesture

After the host commits `naima-tracker/` and the source's main moves on: clone the host, clone the source's main into its `naima-tracker/naima/`, run `naima check`. Then make the source unreachable, add a git worktree of the host, and run `naima check` in it with the main worktree's launcher.

Pass: both runs exit 0; in both, `naima-tracker/naima/` is at the locked commit, not the source's main, with `origin` the recorded source; the worktree's clone is made from the main worktree's, with no source reachable.

## Result

2026-09-30, the author (agent), automated by `src/distribution.test.ts` ("a second clone of the host aligns"): passes on Deno 2.9.7, Node 26.5.0 and Bun 1.4.2, 57 tests each — the feature's attachments `tests-deno-2026-09-30.txt`, `tests-node-2026-09-30.txt` and `tests-bun-2026-09-30.txt`, in `features/deno-distribution-one-global-install-naima-tracker/attachments/`. Not yet performed by someone other than the author.
