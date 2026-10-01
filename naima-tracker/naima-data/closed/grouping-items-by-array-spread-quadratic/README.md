# Grouping items by array spread is quadratic

Consolidated review 2026-09-30, id `R-46` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **CONFIRMED**.

## Where

`src/core/base.ts:202; src/core/check.ts:109; src/plugins/gates/index.ts:106`

## What is wrong (the failure)

Each of these three grouping loops builds up a new array by spreading on every push, which is O(n^2) in the number of items per group.

## The fix

Replace with a push-based groupBy(items, keyFn) helper shared by all three call sites.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

performance test: grouping a fixture of several thousand items completes without a quadratic slowdown, comparable to the perf evidence already gathered for R-15
