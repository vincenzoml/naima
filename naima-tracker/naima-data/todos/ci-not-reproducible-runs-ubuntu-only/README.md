# CI is not reproducible, and runs on Ubuntu only

Consolidated review 2026-09-30, id `R-18` (see the linked review item for
the full review). Severity as scored by the review: **medium**,
status **CONFIRMED**.

## Where

`.github/workflows/ci.yml:17-47`

## What is wrong (the failure)

Actions and runtime versions float (unpinned), so a red build can come from a toolchain release rather than a real regression, and Windows/macOS are never exercised.

## The fix

Pin actions by SHA, pin Deno and Bun versions, add an OS matrix (or explicitly declare Windows unsupported), and set timeout-minutes and concurrency.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

verification: a CI run diff shows every action pinned to a SHA and every runtime version pinned, with a green run on each OS in the matrix
