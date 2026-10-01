# `naima release` of a claim the trunk already carries brings the claim back

Consolidated review 2026-09-30, id `R-09` (see the linked review item for
the full review). Severity as scored by the review: **medium**,
status **CONFIRMED**.

## Where

`src/core/git.ts:140-145; src/plugins/coordination/index.ts:108-110,124,151-158`

## What is wrong (the failure)

After `naima release`, `naima claims` still shows the released item, a second `release` throws, and re-claiming it writes a second claim file instead of reusing the first.

## The fix

Treat a claim file present on HEAD but missing in the worktree as deleted, across all refs. `myClaim` should also match the current branch's non-local claim files.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `coord.ts`, `coord.out`, attached in `attachments/`.


## Done

regression test: releasing a claimed item makes it disappear from `naima claims` for good, a second release does not throw, and re-claiming reuses one claim file, named after case R3 in plugins-repro/coord.ts
