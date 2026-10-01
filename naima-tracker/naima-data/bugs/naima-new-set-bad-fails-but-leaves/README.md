# `naima new --set <bad>` fails but leaves a half-made item on disk

Consolidated review 2026-09-30, id `R-10` (see the linked review item for
the full review). Severity as scored by the review: **medium**,
status **CONFIRMED**.

## Where

`src/core/base.ts:74-76`

## What is wrong (the failure)

A typo in a --set field exits 2, yet the item directory is created anyway, and a retry with the same title creates a second item ("slug-2") instead of fixing the first.

## The fix

Parse and validate every --set assignment against a draft meta object before writing anything, then write the item directory once.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `r1.ts`, attached in `attachments/`.


## Done

regression test: `naima new bugs "X" --set badfield=1` leaves no item directory behind and exits non-zero, named after core-repro/r1.ts section 2
