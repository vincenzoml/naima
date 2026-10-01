# Both directions of a link can be stored for the same relation

Consolidated review 2026-09-30, id `R-24` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **CONFIRMED**.

## Where

`src/core/base.ts:45-53; src/core/check.ts:61-88`

## What is wrong (the failure)

Linking A to B and then B to A (inverse) stores both directions, so the link shows twice when either item is displayed.

## The fix

addLink checks the inverse relation before storing, and the links check reports a doubly-stored link as a problem.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `r1.ts`, attached in `attachments/`.


## Done

regression test: linking A `relates-to` B then B `relates-to` A leaves exactly one stored link, named after core-repro/r1.ts section 3
