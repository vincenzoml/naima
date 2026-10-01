# `naima new` overwrites an existing item on a case-insensitive filesystem or under concurrent runs

Consolidated review 2026-09-30, id `R-02` (see the linked review item for
the full review). Severity as scored by the review: **high**,
status **CONFIRMED**.

## Where

`src/core/item.ts:25,63-70`

## What is wrong (the failure)

The slug-taken test is case-sensitive and mkdirSync({recursive}) never fails, so creating "Crash-Save" over an existing "crash-save" loses its id and prose, and 8 parallel `new` runs leave only 1-3 items instead of 8.

## The fix

Compare taken slugs lowercased. Create the item directory with a non-recursive mkdirSync, and on EEXIST retry with the next numeric suffix.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `r1.ts`, `r3.sh`, `r3.out`, attached in `attachments/`.


## Done

regression test: creating an item whose slug differs only in case from an existing one is refused/suffixed instead of overwriting it, named for the race: 8 concurrent `naima new` calls with colliding titles produce 8 distinct items
