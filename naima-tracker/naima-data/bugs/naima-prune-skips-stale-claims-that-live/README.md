# `naima prune` skips stale claims that live only on other branches' refs

Consolidated review 2026-09-30, id `R-37` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **CONFIRMED**.

## Where

`src/plugins/coordination/index.ts:204-207`

## What is wrong (the failure)

`prune` reports "every claim names a branch that exists" while `naima claims` simultaneously lists stale claims read from other refs, contradicting itself.

## The fix

List the non-local stale claims too, naming the ref each one must be dropped from.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

regression test: a stale claim visible only on another branch's ref is listed by `naima prune`, not hidden from it
