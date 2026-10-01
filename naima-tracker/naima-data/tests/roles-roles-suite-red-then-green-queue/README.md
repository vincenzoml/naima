# Roles: roles suite red then green, queue --role

Proves the roles plugin's declared vocabulary and the per-role queue view, by gesture.

## Gesture

```sh
deno test -A test/plugins/roles   # then node --test and bun test on the whole suite
```

`test/plugins/roles/roles.test.ts` pins: the thirteen default roles are present, each with what it owns and a non-empty list of refusals, and a configured role with no refusal is refused at load; naima queue --role lists one role's open items most urgent first, by explicit role (which wins over kind), by kind, or by type (every tests item is the tester's), restricted to a gate when one is named, a project's configured role included, an unknown role an error naming the roles; naima roles --json counts each queue; a kind no role takes is a note, a kind a role takes is not; without the roles plugin, queue --role says so.

Must appear: red before the plugin exists; green on Deno, Node and Bun.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u18-roles

Ran this session: red, both new suites failed to type-check with the plugin sources stashed (4 errors, modules absent). Green: deno task verify 337 passed 0 failed 1 ignored, naima check all invariants hold; node --test 338 tests 337 pass 0 fail; bun test 337 pass 0 fail.
