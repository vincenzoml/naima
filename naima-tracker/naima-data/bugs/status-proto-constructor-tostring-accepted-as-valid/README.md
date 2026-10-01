# A status of `__proto__`, `constructor` or `toString` is accepted as a valid item status

Consolidated review 2026-09-30, id `R-05` (see the linked review item for
the full review). Severity as scored by the review: **medium**,
status **CONFIRMED**.

## Where

`src/core/base.ts:25; src/core/check.ts:38; src/core/registry.ts:36`

## What is wrong (the failure)

`in` matches Object.prototype keys, so `set status=__proto__` passes `naima check`, and the item silently counts as open with no real status definition.

## The fix

Use Object.hasOwn(statuses, raw) in all three places instead of the `in` operator.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `r1.ts`, attached in `attachments/`.


## Done

regression test: `naima set <item> status=__proto__` is refused as an unknown status, and `naima check` fails on a tracker where it was forced onto disk, named after core-repro/r1.ts section 1
