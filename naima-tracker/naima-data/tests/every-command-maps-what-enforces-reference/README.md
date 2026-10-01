# Every command maps to what it enforces in the reference

Proves the command-to-policy map: every command the entry point answers and every first-party plugin contributes says what it enforces, and the generated reference maps each to it.

How: `node --test test/plugins/docs/policy-map.test.ts` (also run by `deno task verify` and `bun test`). It loads every first-party plugin, opt-in ones included, asserts each command's `enforces` is set and that "Commands at a glance" in the generated reference has a non-empty "What it enforces" cell for each; and that a command without the field is reported undocumented.

Passes when: both tests pass, and `deno task verify` (which runs `naima docs --check` on naima/docs/reference/reference.md) exits 0.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/f-u5-policy-map

Run on claude/f-u5-policy-map at e0824c5, 2026-10-01: node --test test/plugins/docs/policy-map.test.ts, 2 of 2 pass (every one of the 52 commands, entry point and first-party plugins with opt-in ones loaded, says what it enforces and has a non-empty cell in the reference table; a plugin command without the field is a note in naima check, never a problem). deno task verify exits 0, including naima docs --check on the reference; node 362 of 362 and bun 362 of 362 pass.
