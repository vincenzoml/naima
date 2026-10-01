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
