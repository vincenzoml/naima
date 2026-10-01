# The suite passes on Deno, Node and Bun in CI

## Gesture

Push to GitHub and read the `ci` workflow run: `deno task verify` on Deno, `node --test "src/**/*.test.ts"` on Node, `bun test ./src/` on Bun.

Pass: the three jobs succeed.

## Result

2026-09-30, GitHub Actions, run https://github.com/vincenzoml/naima/actions/runs/36683772145
on `068ace6`: the `deno`, `node` and `bun` jobs succeed —
`attachments/ci-run-2026-09-30.json`. The `deno` job's `verify` includes
`check` through the launcher, which cloned the program from the checkout's own
objects, without the network.
