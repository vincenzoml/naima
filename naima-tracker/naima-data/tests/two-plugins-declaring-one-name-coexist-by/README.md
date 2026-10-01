# Two plugins declaring one name coexist by qualified id or a rename

From the repository root, on Deno, then Node and Bun:

```sh
deno test -A src/core/names.test.ts
node --test src/core/names.test.ts
bun test src/core/names.test.ts
```

A pass: every test passes: a stored name declared twice is refused naming both qualified ids and the rename; with the rename both load, the renamed field is stored under its new name and its own plugin reads it so; commands sharing a name run by qualified id and the short name is refused as ambiguous; a rename of a first-party or undeclared contribution is refused.

## Result

Not yet performed as this item's gesture; the branch that wrote the code ran the whole suite green on the three runtimes, which is its own homework, not this proof.
