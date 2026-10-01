# The features-documented check accepts an empty or directory-only `docs` reference

Consolidated review 2026-09-30, id `R-33` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **CONFIRMED**.

## Where

`src/plugins/docs/index.ts:241-247,326`

## What is wrong (the failure)

Setting docs=#x (no file path, only a heading fragment) passes the features-documented check with no actual documentation behind it.

## The fix

Require a non-empty path to an existing .md file before accepting a docs reference.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `misc.ts`, attached in `attachments/`.


## Done

regression test: naima check fails on a shipped feature whose docs field is `#x` or empty, named after case R13 in plugins-repro/misc.ts
