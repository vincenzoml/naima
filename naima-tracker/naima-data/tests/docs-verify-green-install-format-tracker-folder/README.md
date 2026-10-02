# docs verify green: install, format and tracker-folder describe the clone, naima-dev links resolve

From a checkout of `claude/split-docs`, run:

```sh
deno task verify
grep -rn "naima-copy\|NAIMA_CACHE\|carry \|dist branch" naima/docs naima/skills naima/README.md
```

Must see: `all invariants hold`, no failed test, and the grep returns only
unrelated uses of the word "carry" (never the removed mechanisms) outside
`naima/docs/reference/reference.md`, which unit 1 regenerates.
