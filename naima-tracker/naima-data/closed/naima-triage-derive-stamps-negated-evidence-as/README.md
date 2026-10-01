# `naima triage derive` stamps negated evidence as `measured`

Consolidated review 2026-09-30, id `R-12` (see the linked review item for
the full review). Severity as scored by the review: **medium**,
status **CONFIRMED**.

## Where

`src/plugins/triage/index.ts:78-84`

## What is wrong (the failure)

A sentence like "could not be reproduced" is read as positive evidence and gets stamped with the highest confidence, `measured`, instead of the lowest.

## The fix

Test for a negation up to 3 words before the positive verb, before deciding the sentence is a positive test.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `misc.ts`, `misc.out`, attached in `attachments/`.


## Done

regression test: an item whose evidence reads "could not be reproduced" is derived to a low confidence, not `measured`, named after case R7 in plugins-repro/misc.ts
