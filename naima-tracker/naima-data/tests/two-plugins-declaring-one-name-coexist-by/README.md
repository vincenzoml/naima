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

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

Full suite pass on main's head (commit 623fd87af5526fccdf685f4d0825ac0e062b4509). deno task verify: 220/220 passed, 0 failed. node --test test/**/*.test.ts: 220/220 passed. bun test --timeout 30000 ./test/: 220/220 passed. Logs kept as evidence in the session scratchpad (verify-deno.log, node-test.log, bun-test.log).
