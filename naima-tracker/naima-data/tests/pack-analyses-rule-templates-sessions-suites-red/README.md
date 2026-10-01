# pack-analyses, rule-templates and sessions: suites red then green

```sh
node --test "test/plugins/pack-analyses/**/*.test.ts" "test/plugins/rule-templates/**/*.test.ts" "test/plugins/planning/**/*.test.ts"
```

Red before the plugins and the `sessions` type existed: the three new test
files did not resolve (`Cannot find module`), and the planning suite's new
session test failed for want of the type and the `records`/`sittingRun`
field. Green afterward: 9 passed, 0 failed.

`deno task verify` (typecheck, lint, format, `node --test`, `bun test`,
`naima check`, `naima docs --check`, the program's own `naima check`) passes
in full, including `test/arch.test.ts`'s scan that the core speaks no
plugin's vocabulary (caught the field name `run` colliding with a core
literal; renamed to `sittingRun`) and `test/plugins/verifier-mcrl2`'s opt-in
plugin list (updated to filter by name, since two more opt-in plugins now
exist beside the model checkers).

## Result

Passed, 2026-10-01, agent gesture (the test suites above), `deno task verify`
green in full.
