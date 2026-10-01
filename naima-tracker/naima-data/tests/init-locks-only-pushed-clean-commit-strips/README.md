# init locks only a pushed clean commit, strips credentials, names a real type

## Gesture

1. `deno test -A src/init.test.ts`: passes.
2. By hand, in a fresh repository with Naima cloned into
   `naima-tracker/naima/`: commit something in the clone without pushing, and
   run `init` — refused with `has commits its source does not have`, nothing
   written. Edit a tracked file there — refused with `has uncommitted
   changes`.
3. Set the clone's origin to `https://user:token@github.com/vincenzoml/naima.git`
   and run `init`: `naima.json` has `https://github.com/vincenzoml/naima.git`,
   and no output line holds the token.
4. `init`'s last line is `next: naima new <type> …` with a type `naima types`
   lists; with no creatable type loaded it is `next: naima help`.

Pass: all hold.

## Result

Step 1 performed by the author on 2026-09-30: pass. Steps 2–4 not performed
by hand.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

Full suite pass on main's head (commit 623fd87af5526fccdf685f4d0825ac0e062b4509). deno task verify: 220/220 passed, 0 failed. node --test test/**/*.test.ts: 220/220 passed. bun test --timeout 30000 ./test/: 220/220 passed. Logs kept as evidence in the session scratchpad (verify-deno.log, node-test.log, bun-test.log).
