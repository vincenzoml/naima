# `naima show`/`naima set` with an empty reference silently acts on the only item

Consolidated review 2026-09-30, id `R-26` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **CONFIRMED**.

## Where

`src/core/repo.ts:59-60; src/core/base.ts:88,130`

## What is wrong (the failure)

An empty string as the item reference matches every slug via substring/prefix matching, so it resolves to "the only item" instead of failing.

## The fix

Treat an empty reference as a usage error, and require at least one field=value pair in `naima set`.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `r7.ts`, attached in `attachments/`.


## Done

regression test: `naima show ""` and `naima set ""` exit with a usage error instead of acting on an item, named after core-repro/r7.ts
