# Naima runs its own repository on naima/ under v0.2.0, verified by stable and working tree

## Gesture

In a fresh clone of Naima's repository:

1. `npm run stable:which` — prints the pin in `naima/config.json`, `v0.2.0`,
   its commit, and a cache directory outside the repository.
2. `npm run verify` — typecheck, tests, `check` with the working tree, the
   reference current, and `check` with the stable.
3. `git status --porcelain --ignored` — nothing but `node_modules` and `dist/`.

Pass: all three hold.

## Result

2026-09-30, the author (agent), worktree of branch `adoption`: `stable:which`
resolves `^0.2.0` to `v0.2.0` cached under `~/Library/Caches/naima`; verify
passes (44 tests; `all invariants hold` with both builds; the reference is
current). `attachments/verify-2026-09-30.txt`. Not yet performed in a fresh
clone by someone other than the author.

## Withdrawn, 2026-09-30

Naima no longer runs its tracker from a tagged release under a pin, nor from `naima/` (the Deno distribution feature). Its successor is `tests/naima-s-own-tracker-managed-by-locked`.
