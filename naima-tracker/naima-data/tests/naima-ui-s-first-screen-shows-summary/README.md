# naima ui's first screen shows summary, gates and next up, each panel's data equal to the CLI's --json

The gesture that proves it, step by step, and what a pass looks like.

`deno test -A test/plugins/ui/ui.test.ts`, the test "the first screen shows
the summary, the gates and what is next": in a project with a gate and three
bugs written after the server started, `/data/summary`, `/data/gates` and
`/data/next` equal `naima summary --json`, `naima gates --json` and
`naima view --json next`; Home is the first tab, the three panels come in that
order, titles are escaped, and no panel failed. A second test shows a failing
panel saying so in its place. `test/launcher.test.ts` serves the first screen
under the launcher's grants.

Pass: both tests green on Deno, Node and Bun.

## Result

What was seen, when, and by whom.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/final-sweep

Run in the final sweep (claude/final-sweep, 2026-10-01): the two first-screen tests of test/plugins/ui/ui.test.ts and test/launcher.test.ts green on Deno (deno task verify: 363 passed, 0 failed), Node (364 tests, 363 pass, 0 fail) and Bun (363 pass, 1 skip, 0 fail).
