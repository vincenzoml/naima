# Trunk detection fails on a non-`main`/`master` trunk, and detached HEAD is mishandled

Consolidated review 2026-09-30, id `R-08` (see the linked review item for
the full review). Severity as scored by the review: **medium**,
status **CONFIRMED**.

## Where

`src/core/git.ts:58-64,87,92-94,138-145; src/plugins/coordination/index.ts:122,203`

## What is wrong (the failure)

A trunk named `develop` makes git fail, so no branch is read at all. On a detached HEAD, a deleted record can be read back, and a claim records branch "HEAD" and is later pruned as stale.

## The fix

Resolve the trunk from origin/HEAD, then main, then master, and read every local branch if none of those exist. Skip the HEAD sha. Refuse `naima claim` on a detached HEAD.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `r2.ts`, attached in `attachments/`.


## Done

regression test: a repository whose trunk is named `develop` is still read correctly by cross-branch views, and `naima claim` on a detached HEAD is refused, named after core-repro/r2.ts (the detached-HEAD claim behaviour is not yet reproduced, marked plausible)
