# On Windows, backslash paths break cross-branch reads and the beta-marker skip filter

Consolidated review 2026-09-30, id `R-14` (see the linked review item for
the full review). Severity as scored by the review: **medium**,
status **PLAUSIBLE**.

## Where

`src/core/git.ts:42,110,115; src/plugins/coordination/index.ts:61; src/plugins/beta-markers/index.ts:65`

## What is wrong (the failure)

Paths built with the OS separator are handed to git (which wants posix paths) and compared against posix skip patterns, so on Windows every other branch contributes nothing to cross-branch views, and the SKIP filter never matches.

## The fix

Normalise to posix wherever a path enters or leaves git, in projectFiles and readAcrossBranches.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

regression test (run on Windows, or with paths forced through the same normalisation code): cross-branch reads on Windows return the same file set as on posix
