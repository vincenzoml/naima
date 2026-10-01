# A plugin adds a type, a status, a value and a field by trait to another's vocabulary

From the repository root, on Deno, then Node and Bun:

```sh
deno test -A src/extending.test.ts
node --test src/extending.test.ts
bun test src/extending.test.ts
```

A pass: every test passes: a third-party `incidents` type tagged `fixable` takes `fixedOn`, and so do features; a `blocked` status is added to bugs and `pager` to runBy with an open-ended flag read by hasFlag; redefining a status's category, contradicting flags, values on a date field are refused; transitions refuse a move and a forced write takes it; the gate field takes every contributed gate and an item may be on several; naima.json's `extends` does the same.

## Result

Not yet performed as this item's gesture; the branch that wrote the code ran the whole suite green on the three runtimes, which is its own homework, not this proof.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

Full suite pass on main's head (commit 623fd87af5526fccdf685f4d0825ac0e062b4509). deno task verify: 220/220 passed, 0 failed. node --test test/**/*.test.ts: 220/220 passed. bun test --timeout 30000 ./test/: 220/220 passed. Logs kept as evidence in the session scratchpad (verify-deno.log, node-test.log, bun-test.log).
