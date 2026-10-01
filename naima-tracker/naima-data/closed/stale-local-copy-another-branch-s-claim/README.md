# A stale local copy of another branch's claim overrides that branch's newer claim

Consolidated review 2026-09-30, id `R-03` (see the linked review item for
the full review). Severity as scored by the review: **high**,
status **CONFIRMED**.

## Where

`src/core/git.ts:145`

## What is wrong (the failure)

From the trunk, worker w's claim shows only its old claim (alpha, marked "working tree") while its branch actually holds alpha and beta.

## The fix

A local claim file wins only when its recorded branch is the current branch. Otherwise prefer the owner branch's ref.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `coord.ts`, `coord.out`, attached in `attachments/`.


## Done

regression test: `naima claims` read from the trunk after a worker branch has claimed a second item shows both items for that branch, not the stale local copy
