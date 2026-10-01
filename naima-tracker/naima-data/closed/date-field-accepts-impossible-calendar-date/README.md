# A `date` field accepts an impossible calendar date

Consolidated review 2026-09-30, id `R-27` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **CONFIRMED**.

## Where

`src/core/fields.ts:6`

## What is wrong (the failure)

A value like 2024-13-99 is accepted, stored, and passes naima check, even though month 13 and day 99 do not exist.

## The fix

Validate the month (1-12) and day (1-31, or per-month) ranges in the date field kind before accepting the value.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `r7.ts`, attached in `attachments/`.


## Done

regression test: setting a date field to 2024-13-99 is refused by naima check, named after core-repro/r7.ts
