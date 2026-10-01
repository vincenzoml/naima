# Three independent file walkers with their own skip rules, and one returns non-file entries

Consolidated review 2026-09-30, id `R-30` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **PLAUSIBLE**.

## Where

`src/core/git.ts:44-53; src/plugins/beta-markers/index.ts:36-59; src/plugins/docs/index.ts:251-262`

## What is wrong (the failure)

A submodule causes EISDIR in one walker, a symlink can lead a walker to read outside the repository, and the beta-markers and docs plugins scan different trees because their skip rules disagree.

## The fix

One core walk(root,{include,skip}) helper that keeps only lstat().isFile() entries, reused by all three call sites.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

regression test: a repository containing a submodule directory and a symlink pointing outside the repo no longer crashes or leaks paths when beta-markers and docs both walk it
