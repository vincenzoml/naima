# A host install's program directory is exactly naima/

The gesture: from the root of Naima's repository, run

```sh
deno test -A test/dist.test.ts test/site.test.ts
```

What must appear: every test passes. The test "a project clones the dist"
clones the dist branch into a fresh host and asserts that the files of its
`naima-tracker/naima/` equal the files of `naima/` (`onDisk(program)` equals
`shipped`), again in a second worktree and after `naima update`. The test
"a project locked to a commit of main" asserts the same after an update moves
a main-commit install onto the dist. `install.sh` installs from a dist built
on this disk, and no test reaches the host.

The negative half: a file outside `naima/`, such as a test, `AGENTS.md` or a
tracker item, fails "the dist holds only what runs Naima".

Run by an agent, on Deno; CI runs the same file on Node and Bun.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

Full suite pass on main's head (commit 623fd87af5526fccdf685f4d0825ac0e062b4509). deno task verify: 220/220 passed, 0 failed. node --test test/**/*.test.ts: 220/220 passed. bun test --timeout 30000 ./test/: 220/220 passed. Logs kept as evidence in the session scratchpad (verify-deno.log, node-test.log, bun-test.log).
