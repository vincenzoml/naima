# The plugins table reaches first-party options, switches off, replaces and weighs checks

From the repository root, on Deno, then Node and Bun:

```sh
deno test -A src/configuration.test.ts
node --test src/configuration.test.ts
bun test src/configuration.test.ts
```

A pass: every test passes: `docs`' reference option makes `reference-current` fail, then hold once written; `beta-markers`' paths limit the scan; `enabled: false` removes a plugin; `replacedBy` runs other code under the first-party name; `checks` weighs core and plugin checks off, note or problem, and a check nobody declares is refused; format-1 data (a plugins list, a top-level gates key) is migrated.

## Result

Not yet performed as this item's gesture; the branch that wrote the code ran the whole suite green on the three runtimes, which is its own homework, not this proof.
