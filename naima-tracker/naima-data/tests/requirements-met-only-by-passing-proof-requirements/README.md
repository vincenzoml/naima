# Requirements are met only by a passing proof, and the requirements view traces them

The gesture: run `deno test -A test/plugins/planning/planning.test.ts`, test "a requirement is met only by a passing proof". It opens a requirement, links a feature `satisfies` and a test `verifies`, and asserts: a requirement with nothing behind it is noted; `met` with no passing proof is a problem; a passed test makes a stated requirement noted as proven; `met` with a passing proof raises nothing; a failed test makes `met` a problem; `naima view requirements` (text and `--json`) lists what satisfies and what proves it.

## Result

2026-10-01, agent on claude/u6-planning (commit fca156d). Red first against a stub plugin: 0 passed, 3 failed. Green: 3 passed, 0 failed; whole suite 223 passed on Deno, Node and Bun. Also run by hand in a scratch project with the working-tree CLI: the view printed `✓ … [met] proven` with its satisfied-by and proven-by lines.
