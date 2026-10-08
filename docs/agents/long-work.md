# Long work

For any command expected to outlast a few minutes, or to run on another
machine. The rule is on the rules page:
[long work goes through naima run and naima wait](../guide/rules.md#long-work-goes-through-naima-run-and-naima-wait).

1. **Start** it with a name, a time budget you can justify, and — when it
   writes stores or temporary data — what it creates and a disk budget:
   `naima run <name> --budget-time <d> [--budget-disk <size> --creates <path>...] [--host <h>] -- <command>`.
   Have the command write its progress to `$NAIMA_RUN_PROGRESS` when it can.
2. **Wait** with `naima wait <name> --timeout <d>`, a timeout under your
   tool call's limit. At the timeout it exits 1 saying the run still runs:
   check `naima run list` (stale? lost? progress moving?), do other work if
   there is any, then decide to wait again or `naima run stop <name>`.
3. **Report** from `naima wait`'s output: state, exit status, budgets, log
   tail — the numbers with the budget they are compared to.
4. **Clean** with `naima run clean <name>` once the results are kept
   elsewhere: it removes exactly what was declared.

Never: a `while`/`until` loop with `sleep`, `pgrep -f`/`pkill -f`, a bare
`nohup ... &`, polling a remote file over ssh by hand. `naima check` flags
such waits in committed scripts (check `wait-loops`); a script that truly
needs a retry loop marks the line `naima: allow-wait-loop <reason>`.
