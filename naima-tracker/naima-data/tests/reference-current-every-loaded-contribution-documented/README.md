# The reference is current and every loaded contribution is documented

## Gesture

1. `deno task verify` passes.
2. Remove the `examples` of any command in `src/`; `deno task verify` fails
   naming the command. Restore it.
3. Change any `says` in a manifest without running `deno task docs`;
   `deno task verify` fails saying `docs/reference.md` is out of date.

Pass: all three hold.

## Result

Not yet performed by someone other than the author.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

Full suite pass on main's head (commit 623fd87af5526fccdf685f4d0825ac0e062b4509). deno task verify: 220/220 passed, 0 failed. node --test test/**/*.test.ts: 220/220 passed. bun test --timeout 30000 ./test/: 220/220 passed. Logs kept as evidence in the session scratchpad (verify-deno.log, node-test.log, bun-test.log).
