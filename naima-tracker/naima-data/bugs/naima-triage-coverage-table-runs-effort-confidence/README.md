# naima triage coverage table runs the effort and confidence headers together

Seen while writing the guide, in a scratch project running this branch's
Naima:

```
$ naima triage
  type         open    priority    impact    effortconfidence   derived
  bugs            1           0         0         0         0   0
```

Measured: the header pads each name to 10 characters with `padStart`, and
`confidence` is 10 characters long, so nothing separates it from `effort`
(`src/plugins/triage/index.ts`, the coverage `ctx.out` line).

Consequence: cosmetic; the column is still readable by position.
