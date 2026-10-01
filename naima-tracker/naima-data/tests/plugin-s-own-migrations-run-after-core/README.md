# A plugin's own migrations run after the core's, record its format and are held by one-format

From the repository root, on Deno, then Node and Bun:

```sh
deno test -A src/core/format.test.ts
node --test src/core/format.test.ts
bun test src/core/format.test.ts
```

A pass: every test passes: a plugin's migrations run after the core's and write `formats` (byte-identical twice, idempotent); data a newer plugin wrote is refused; an item still in a plugin's old shape fails `one-format`; data that owes a migration is refused by the launched program and read migrated in memory by the development build, writing nothing.

## Result

Not yet performed as this item's gesture; the branch that wrote the code ran the whole suite green on the three runtimes, which is its own homework, not this proof.
