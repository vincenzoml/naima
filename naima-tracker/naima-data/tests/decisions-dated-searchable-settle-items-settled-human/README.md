# Decisions are dated, searchable, settle items, and a settled human item is noted

The gesture: run `deno test -A test/plugins/planning/planning.test.ts`, test "a decision is dated and settled on creation". It records a decision (asserting status `settled` and `decidedOn` stamped with today), links it `settles` to a todo with `runBy: human`, `humanBecause: decision`, and asserts: the todo is noted as already settled; `naima decisions journal` finds it and `naima decisions workshop` says to ask and record; a later decision that `supersedes` it while it is still settled is a problem; `--all` includes the superseded one; a `standing=true` decision is shown as a standing permission.

## Result

2026-10-01, agent on claude/u6-planning (commit fca156d). Red first against a stub plugin: 0 passed, 3 failed. Green: 3 passed, 0 failed; whole suite 223 passed on Deno, Node and Bun. By hand in a scratch project: `naima decisions journal` printed the decision with its date and the todo it settles.
