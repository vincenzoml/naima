# Verifier inputs are unchecked: an undeclared field, an unchecked cast, and a path-escape

Consolidated review 2026-09-30, id `R-44` (see the linked review item for
the full review). Severity as scored by the review: **medium**,
status **CONFIRMED**.

## Where

`src/plugins/verifier/index.ts:55,58,72,74`

## What is wrong (the failure)

verifierOptions is used as an undeclared field with no schema, RunRecord is cast from disk without any validation, and a `../` inside model or lastRun can escape the tracker root and read/write outside it.

## The fix

Declare verifierOptions as a real field, validate the run record shape before trusting it, and confine model/lastRun paths to the tracker root or attachments/.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

regression test: a model path containing `../../../etc/passwd` is refused rather than followed, and a malformed run record on disk is reported instead of trusted as-is
