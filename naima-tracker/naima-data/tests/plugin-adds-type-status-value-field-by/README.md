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
