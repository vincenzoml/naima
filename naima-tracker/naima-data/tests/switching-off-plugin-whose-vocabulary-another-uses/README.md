# Switching off a plugin whose vocabulary another uses fails at load, named

From the repository root, on Deno, then Node and Bun:

```sh
deno test -A src/uses.test.ts
node --test src/uses.test.ts
bun test src/uses.test.ts
```

A pass: every test passes: gates, beta-markers and docs declare their uses and they resolve; without trackers, loading fails with `plugin "gates" uses field "fixedOn", which no loaded plugin declares`; a third-party plugin's missing, ambiguous and point-less uses are each refused.

## Result

Not yet performed as this item's gesture; the branch that wrote the code ran the whole suite green on the three runtimes, which is its own homework, not this proof.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

Full suite pass on main's head (commit 623fd87af5526fccdf685f4d0825ac0e062b4509). deno task verify: 220/220 passed, 0 failed. node --test test/**/*.test.ts: 220/220 passed. bun test --timeout 30000 ./test/: 220/220 passed. Logs kept as evidence in the session scratchpad (verify-deno.log, node-test.log, bun-test.log).
