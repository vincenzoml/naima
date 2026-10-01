# The launcher refuses a comma path, hands only allow-listed env, parses --data once

## Gesture

1. `deno test -A src/launcher.test.ts src/core/lock.test.ts`: passes.
2. By hand: a project at a path holding a comma (`/tmp/a,b/project`): any
   command fails in one line naming the path and the comma, not with Deno's
   `NotCapable`.
3. `UNRELATED_SECRET=x naima <a plugin command that prints
   Deno.env.get("UNRELATED_SECRET")>` prints `undefined`; `GIT_*` variables
   and `HOME` are still there, and `naima update --check` over ssh still
   reaches the source (ssh-agent through `SSH_AUTH_SOCK`).
4. `--data` is parsed by `globalOptions` (`src/core/layout.ts`) in both the
   launcher and the program: `grep -n dataOption src/launcher.ts` finds
   nothing.

Pass: all hold.

## Result

Steps 1 and 4 performed by the author on 2026-09-30: pass. Step 3's ssh half
not performed: every test source is on this disk.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

Full suite pass on main's head (commit 623fd87af5526fccdf685f4d0825ac0e062b4509). deno task verify: 220/220 passed, 0 failed. node --test test/**/*.test.ts: 220/220 passed. bun test --timeout 30000 ./test/: 220/220 passed. Logs kept as evidence in the session scratchpad (verify-deno.log, node-test.log, bun-test.log).
