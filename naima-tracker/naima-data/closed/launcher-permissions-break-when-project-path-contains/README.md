# Launcher permissions break when a project path contains a comma

Consolidated review 2026-09-30, id `R-11` (see the linked review item for
the full review). Severity as scored by the review: **medium**,
status **CONFIRMED**.

## Where

`src/launcher.ts:43`

## What is wrong (the failure)

Deno splits `--allow-*` permission lists on commas, so every naima command fails with NotCapable when the repository (or its ancestor directories) has a comma in its path.

## The fix

Detect a comma in the resolved path and refuse with a clear message, or grant the nearest comma-free ancestor directory instead.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `r6.ts`, `r6.out`, attached in `attachments/`.


## Done

regression test: running naima from a directory whose path contains a comma either works or fails with a clear, named error instead of an opaque Deno NotCapable, named after core-repro/r6.ts
