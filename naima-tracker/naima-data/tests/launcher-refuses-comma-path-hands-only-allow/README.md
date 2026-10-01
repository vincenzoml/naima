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
