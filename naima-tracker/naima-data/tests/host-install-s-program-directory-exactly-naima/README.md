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
