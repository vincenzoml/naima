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

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u8-papercuts

Fixed: naima/src/plugins/triage/index.ts's coverage table joined its header and its per-type rows with no separator between columns, so a full-width column (confidence) glued onto the one before it (effort, effortconfidence). Both joins now use " " instead of "". Regression test added to test/plugins/triage/triage.test.ts, red on the old code, green now.
