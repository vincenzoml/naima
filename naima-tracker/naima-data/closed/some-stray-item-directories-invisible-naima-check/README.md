# Some stray item directories are invisible to `naima check`, or only get a note

Consolidated review 2026-09-30, id `R-28` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **CONFIRMED**.

## Where

`src/core/item.ts:52; src/core/check.ts:90-98`

## What is wrong (the failure)

A directory named `_draft/`, a symlinked item directory, and a misspelled type directory `bgus/` (instead of `bugs/`) all pass naima check silently or with only a note, rather than being reported as a problem.

## The fix

Report these as unreadable items, and make a stray directory that matches no declared type a check problem (or correct architecture.md if this is intentional).

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `r8.ts`, attached in `attachments/`.


## Done

regression test: a `bgus/` directory (misspelled type) is reported as a problem by naima check, not silently ignored, named after core-repro/r8.ts
