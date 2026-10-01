# A plugin pinned by hash or commit runs with the injected API, a newer contract is refused

From the repository root, on Deno, then Node and Bun:

```sh
deno test -A src/external.test.ts src/arch.test.ts
node --test src/external.test.ts src/arch.test.ts
bun test src/external.test.ts src/arch.test.ts
```

A pass: every test passes: a project file pinned by sha256 runs importing nothing of the core, and is refused naming its new hash once changed; a git module pinned by commit is fetched into naima-tracker/plugins/, ignored by git, refused with local changes or an unknown commit; a newer contract is refused, none reads as contract 1; plugins import only core/api.ts, which exports nothing that loads, migrates or runs the program; the injected API is frozen.

## Result

Not yet performed as this item's gesture; the branch that wrote the code ran the whole suite green on the three runtimes, which is its own homework, not this proof.
