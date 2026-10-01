# The gated-proof-is-gated check ignores its own documented "or ranks below" clause

Consolidated review 2026-09-30, id `R-35` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **CONFIRMED**.

## Where

`src/plugins/gates/index.ts:121-135`

## What is wrong (the failure)

The check's own documentation (`says`) describes an "or ranks below" exception that the implementation never evaluates, so the code disagrees with its own stated contract.

## The fix

Implement the rank comparison the documentation describes, or drop the clause from `says` and regenerate the reference to match the simpler behaviour.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

regression test: an item that ranks below the gate's threshold is accepted per the documented clause, or the documentation no longer claims a behaviour the code lacks
