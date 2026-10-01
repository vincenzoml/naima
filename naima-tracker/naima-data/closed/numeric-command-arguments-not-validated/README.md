# Numeric command arguments are not validated

Consolidated review 2026-09-30, id `R-36` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **CONFIRMED**.

## Where

`src/plugins/coordination/index.ts:232; src/plugins/triage/index.ts:150`

## What is wrong (the failure)

`naima pass --list all` silently prints "no session notes" instead of reporting that "all" is not a valid count.

## The fix

Add a shared positiveInt(raw,name) validator in args.ts and use it at both call sites.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `misc.ts`, attached in `attachments/`.


## Done

regression test: `naima pass --list all` (or any non-numeric count) fails with a clear usage error instead of silently returning nothing, named after case R15 in plugins-repro/misc.ts
