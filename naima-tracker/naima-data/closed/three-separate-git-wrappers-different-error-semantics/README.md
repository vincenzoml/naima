# Three separate git wrappers with different error semantics

Consolidated review 2026-09-30, id `R-16` (see the linked review item for
the full review). Severity as scored by the review: **medium**,
status **CONFIRMED**.

## Where

`src/core/git.ts:13; src/core/program.ts:33; src/core/testing.ts:43 (plus copies in two tests)`

## What is wrong (the failure)

Each wrapper discards stderr differently, so callers cannot reliably tell "no such ref" from "git is not installed" from any other failure.

## The fix

Introduce one `runGit` returning `{ok,out,err}`, with `gitOrNull` and `mustGit` derived from it, and one shared helper reused by the tests.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

regression test: a distinguishable error case (missing ref vs missing git binary) is reported differently by the unified wrapper, and the three call sites and the two test copies are gone
