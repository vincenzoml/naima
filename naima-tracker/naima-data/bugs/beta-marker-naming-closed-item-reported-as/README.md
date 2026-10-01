# A beta marker naming a closed item is reported as "no such item"

Consolidated review 2026-09-30, id `R-31` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **CONFIRMED**.

## Where

`src/plugins/beta-markers/index.ts:88-93`

## What is wrong (the failure)

Once `naima close` moves an item to the archive, a beta marker that still names it by its old slug gets the misleading message "no such item" instead of finding it through its closed record.

## The fix

Retry resolution by slug or through closedFrom, and word the error message from the actual resolve failure instead of a generic one.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `ver.ts`, attached in `attachments/`.


## Done

regression test: a beta marker naming an item that was subsequently closed is still resolved (or reported with an accurate message), named after case R11 in plugins-repro/ver.ts
