# Piping a command's output into head crashes with an uncaught EPIPE stack trace

Seen while writing the guide, in a scratch project running this branch's
Naima (commit 89530499e809):

```
$ naima plugins | head -5
core — items, fields, links and the invariants every project has
  commands   new, show, list, set, link, unlink, check, board, view, summary, plugins, types, runs
  ...
error: Uncaught Error: write EPIPE
  out: (line = "") => process.stdout.write(line + "\n"),
    at Object.out (.../naima-tracker/naima/src/core/context.ts:16:38)
    at Object.run (.../src/core/base.ts:330:28)
    at runCli (.../src/core/cli.ts:290:28)
```

Measured: once, with `naima plugins`. Inferred, not tried: any command whose
output outlives the reader (`head`, `grep -m`) does the same, since every
command writes through `context.ts` `out`.

Consequence: a person or agent reading a long listing through `head` sees a
stack trace and may take it for a real failure.
