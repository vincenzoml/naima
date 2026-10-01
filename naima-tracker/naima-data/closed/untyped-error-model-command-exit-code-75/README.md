# Untyped error model, and command exit code 75 is shared between relaunch and ordinary commands

Consolidated review 2026-09-30, id `R-22` (see the linked review item for
the full review). Severity as scored by the review: **medium**,
status **CONFIRMED**.

## Where

`src/core/cli.ts:234-238; `(e as Error)` in 5 files; src/launcher.ts:69`

## What is wrong (the failure)

Usage errors and internal bugs both exit 2 with no stack trace to distinguish them. A plugin command that itself returns exit code 75 is misread as "needs relaunch" and re-run up to 4 times.

## The fix

Add a NaimaError with a machine-readable code, print a stack under NAIMA_DEBUG, use exit 70 for internal errors, add a message(e) helper, and map a command's own 75 to 1 before relaunch logic sees it. Document the exit codes.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

regression test: a plugin command that itself exits 75 runs exactly once, not four times, and internal errors are distinguishable from usage errors by exit code
