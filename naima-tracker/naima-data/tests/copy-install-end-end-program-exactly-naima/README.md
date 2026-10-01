# Copy-on-install end to end: the program is exactly naima/ plus its copy record, copied from the per-user cache offline, updated to main, a dist lock moved by its trailer (on Deno, Node and Bun)

Run, on Deno (`deno task test`), Node (`node --test "test/**/*.test.ts"`) and Bun (`bun test --timeout 30000 ./test/`):

- `test/runtime-folder.test.ts`: naima/ holds no test, fixture, CI file, agent rule or tracker item, and every import and link in it resolves inside it; a project installed from a source holding all of Naima's repository gets exactly naima/'s files plus `.naima-copy.json`, and init, check, new, guide, a new worktree with the source gone (copied from the cache) and an update to a moved main all work on it.
- `test/distribution.test.ts`: the install leaves only naima-tracker/, with the copy gitignored and `carry` left out; a second clone, a new worktree and another project copy the locked commit from the user's cache with the source gone; update follows main, migrates and copies; alignment refuses changed files, an unreachable commit, and no network with nothing cached; forks, permissions, signatures, verifiers and cross-worktree claims as before; carry round-trips copy → vendored → submodule → copy; a lock on a dist commit keeps its clone (also in a new worktree) and `naima update` names it by its Source-Commit trailer, moves the lock to main and turns the clone into a copy; a clone of a main commit becomes a copy unless it holds work.
- `test/site.test.ts`: install.sh from a full-repository source leaves naima/'s files, plus the copy record, gitignored, no .git, no tests, no tracker items, no AGENTS.md or CLAUDE.md, and removes its temporary clone.
- `test/launcher.test.ts`, `test/core/files.test.ts`, `test/core/core.test.ts`: the launcher's fence with the cache, a failed copy leaving the previous program, `carry` parsing (`clone` read as `copy`, the default left out).

Red before: the same files against main's code fail (missing COPY_FILE export; the launcher refusing to read its own unresolved path when run from a clone outside the project). Green after on all three runtimes.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/no-dist

Red then green. Red: the new test files run against main's code (902fb93's predecessor 77d5ce4) fail, 5 of 7 (missing COPY_FILE export; launcher.test's init from a clone outside the project refused by its own unresolved path). Green on claude/no-dist after merging main (12600af): deno task verify 246 passed 0 failed, check and lock check clean; node --test 246/246; bun test --timeout 30000 ./test/ 246/246. CI ci workflow on 096548f green on ubuntu-24.04 and macos-15 for Deno, Node and Bun (run 36834341506), the macOS Deno job included, which runs the successor of the dist test that failed there. Logs: verify-deno.log, node-test.log, bun-test.log in the session scratchpad.

### 2026-10-01 — Vincenzo Ciancia, on claude/no-dist

Correction to the note above: the red run archived the trunk as it stood then (git archive main), not a named commit; 77d5ce4 is only where this branch started.
