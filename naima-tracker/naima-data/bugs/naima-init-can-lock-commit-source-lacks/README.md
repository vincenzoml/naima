# `naima init` can lock a commit the source lacks, and may commit a credential token

Consolidated review 2026-09-30, id `R-07` (see the linked review item for
the full review). Severity as scored by the review: **medium**,
status **CONFIRMED**.

## Where

`src/core/cli.ts:119-127`

## What is wrong (the failure)

Init from a clone with an unpushed commit writes a lock nobody else can fetch. An `https://user:token@...` origin URL is written verbatim into naima.json.

## The fix

Refuse init on a dirty working tree or when the origin lacks the HEAD commit (as `localWork` already does for align), and strip userinfo from the URL before writing it.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `r5.sh`, `r5.out`, `r5.ts`, attached in `attachments/`.


## Done

regression test: `naima init` from a repo with an unpushed commit, or with a token embedded in `origin`, is refused / has the token stripped, named after core-repro/r5.sh (the token-stripping half is not yet reproduced, marked plausible)
