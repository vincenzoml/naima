# The macOS CI job fails: a test's clone races git's background auto-maintenance

The GitHub Actions run for f053e94 (the commit documenting Naima's purpose) failed
on macos-15 for Deno, Node and Bun, passed on ubuntu-24.04, and so skipped the
`dist` job. Every failure is the first local clone in `src/dist.test.ts` (the dist
branch tests), e.g.:

    git -c: failed to copy file to 'naima-tracker/naima/.git/objects/99/7ae4…': No such file or directory

The runner's git is 2.55.0 (`/opt/homebrew/bin/git`) on both images; this Mac has
Apple git 2.50.1 and passes.

## Cause (measured)

`git commit` starts `git maintenance run --auto`, detached. The dist tests commit
a copy of the whole checkout (650 files, about 700 loose objects) and clone it at
once. If maintenance repacks and prunes while `clone` walks `objects/`, the
hardlink and then the copy of a file listed a moment ago both fail with ENOENT,
and git names the destination. Forced here (`-c gc.auto=1` on the commit, 700
files, clone right after): 3 of 5 clones fail with the same message; with
`gc.autoDetach=false` (maintenance finished before the clone): 0 of 5. Why git
2.55 on macOS triggers it with default thresholds while ubuntu does not is not
measured: a newer default maintenance strategy plus timing is a guess.

## Fix

`gitIn` (src/core/testing.ts, git for tests) passes `-c maintenance.auto=false -c
gc.auto=0`: a test's commit starts no maintenance. The runtime's own clones
(src/core/program.ts) copy from a program clone Naima never commits into, so they
are not exposed the same way.

Regression test: "a test's commit starts no background maintenance, so a local
clone right after it finds every object" (src/core/git.test.ts). It configures the
repository to run maintenance in the foreground after every commit; without the
fix it fails deterministically ("no maintenance packed them"), with it, it passes.

## Evidence

The failed CI log (`gh run view 36780649507 -R vincenzoml/naima --log-failed`);
the forced reproduction above.
