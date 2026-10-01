# `meta.json` is typed but never validated on read, and a malformed field crashes commands

Consolidated review 2026-09-30, id `R-13` (see the linked review item for
the full review). Severity as scored by the review: **medium**,
status **CONFIRMED**.

## Where

`src/core/repo.ts:28-30; src/core/types.ts:16-22`

## What is wrong (the failure)

A hand-edited or corrupted `"status": 5` crashes `naima list` with "padEnd is not a function" instead of being reported as a problem.

## The fix

Validate id, title and status in loadRepo, and route items that fail validation to an `unreadable` list instead of crashing.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

regression test: an item whose meta.json has a non-string status is reported by `naima check`/`naima list` as unreadable, not a crash
