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

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

Full suite pass on main's head (commit 623fd87af5526fccdf685f4d0825ac0e062b4509). deno task verify: 220/220 passed, 0 failed. node --test test/**/*.test.ts: 220/220 passed. bun test --timeout 30000 ./test/: 220/220 passed. Logs kept as evidence in the session scratchpad (verify-deno.log, node-test.log, bun-test.log).
