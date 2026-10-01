# Naima loop commands pass on Deno, Node and Bun

Run `test/plugins/loop/loop.test.ts` on Deno (`deno task test`), Node
(`node --test`) and Bun (`bun test`). They were red before the
implementation (the plugin did not exist) and are green after it: refusal
without a target or on an unknown one, a work list with no steps refused,
a work list stopping when every line is done or deferred, `--every`
overriding the plugin's `every` option, `--check` exiting 1 while not
stopped, an epic stopping when only the owner's items are left with the
decision ordered before the judgement, the untried gesture listed, and a
gate stopping when it holds only a build.

## Result

What was seen, when, and by whom.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

Full suite pass on main's head (commit 623fd87af5526fccdf685f4d0825ac0e062b4509). deno task verify: 220/220 passed, 0 failed. node --test test/**/*.test.ts: 220/220 passed. bun test --timeout 30000 ./test/: 220/220 passed. Logs kept as evidence in the session scratchpad (verify-deno.log, node-test.log, bun-test.log).
