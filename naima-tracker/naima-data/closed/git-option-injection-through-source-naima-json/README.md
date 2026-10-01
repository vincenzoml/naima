# Git option injection through `source` in naima.json

Consolidated review 2026-09-30, id `R-01` (see the linked review item for
the full review). Severity as scored by the review: **high**,
status **CONFIRMED**.

## Where

`src/core/program.ts:89,129,140,216; src/core/config.ts:33`

## What is wrong (the failure)

A naima.json with source: "--upload-pack=<cmd>" runs <cmd> on naima update --check, which agents run every session.

## The fix

Reject a source that starts with '-' in parseLock, and put -- before every URL or path argument passed to git.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `inj.ts`, attached in `attachments/`.


## Done

regression test: a source value starting with '-' is refused by parseLock, and git is always invoked with a `--` separator before the source argument
