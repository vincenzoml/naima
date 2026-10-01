# A view renders data once as text, JSON or markdown, and async checks are awaited

From the repository root, on Deno, then Node and Bun:

```sh
deno test -A src/core/rendered.test.ts
node --test src/core/rendered.test.ts
bun test src/core/rendered.test.ts
```

A pass: every test passes: an async view prints its text, `--json` its data, `--markdown` its markdown; a contract-1 view's lines are its text and data; `summary --json` holds each section's data and `--markdown` a heading each; an async check is awaited and one that rejects is a problem.

## Result

Not yet performed as this item's gesture; the branch that wrote the code ran the whole suite green on the three runtimes, which is its own homework, not this proof.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

Full suite pass on main's head (commit 623fd87af5526fccdf685f4d0825ac0e062b4509). deno task verify: 220/220 passed, 0 failed. node --test test/**/*.test.ts: 220/220 passed. bun test --timeout 30000 ./test/: 220/220 passed. Logs kept as evidence in the session scratchpad (verify-deno.log, node-test.log, bun-test.log).
