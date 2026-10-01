# Every command maps to what it enforces in the reference

Proves the command-to-policy map: every command the entry point answers and every first-party plugin contributes says what it enforces, and the generated reference maps each to it.

How: `node --test test/plugins/docs/policy-map.test.ts` (also run by `deno task verify` and `bun test`). It loads every first-party plugin, opt-in ones included, asserts each command's `enforces` is set and that "Commands at a glance" in the generated reference has a non-empty "What it enforces" cell for each; and that a command without the field is reported undocumented.

Passes when: both tests pass, and `deno task verify` (which runs `naima docs --check` on naima/docs/reference/reference.md) exits 0.
