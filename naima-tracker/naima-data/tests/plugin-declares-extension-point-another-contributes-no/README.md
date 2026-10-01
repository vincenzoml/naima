# A plugin declares an extension point another contributes to, with no core edit

From the repository root, on Deno, then Node and Bun:

```sh
deno test -A src/core/points.test.ts src/plugins/docs/docs.test.ts
node --test src/core/points.test.ts src/plugins/docs/docs.test.ts
bun test src/core/points.test.ts src/plugins/docs/docs.test.ts
```

A pass: every test passes: the core's kinds are points and gates and verifiers are not among them; a `notifiers` point declared by one test plugin is contributed to by two others and used by a command; a malformed contribution, a contribution to an undeclared point and an unknown manifest key are refused; an optional contribution is dropped; the reference lists each point, who declares it and who contributes.

## Result

Not yet performed as this item's gesture; the branch that wrote the code ran the whole suite green on the three runtimes, which is its own homework, not this proof.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

Full suite pass on main's head (commit 623fd87af5526fccdf685f4d0825ac0e062b4509). deno task verify: 220/220 passed, 0 failed. node --test test/**/*.test.ts: 220/220 passed. bun test --timeout 30000 ./test/: 220/220 passed. Logs kept as evidence in the session scratchpad (verify-deno.log, node-test.log, bun-test.log).
