# Non-Latin titles collapse to the same slug, and are flagged as false duplicates

Consolidated review 2026-09-30, id `R-25` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **CONFIRMED**.

## Where

`src/core/item.ts:19; src/core/check.ts:108`

## What is wrong (the failure)

Every Cyrillic or CJK title slugs to the literal string "item", so any two such items appear to collide on disk and are reported as duplicates by naima check.

## The fix

Normalise with NFKC, then keep /[^\p{L}\p{N}]+/gu instead of an ASCII-only slugify, in both the slug generator and the duplicate check.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `r1.ts`, attached in `attachments/`.


## Done

regression test: two items with distinct Cyrillic or CJK titles get distinct slugs and are not flagged as duplicates, named after core-repro/r1.ts section 5
