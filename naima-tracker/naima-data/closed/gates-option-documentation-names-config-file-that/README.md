# The gates option documentation names a config file that does not exist

Consolidated review 2026-09-30, id `R-38` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **CONFIRMED**.

## Where

`src/plugins/gates/index.ts:6-7,167; docs/reference.md:656`

## What is wrong (the failure)

The generated reference tells the reader to configure gates in `naima/config.json`, a path from the pre-format-1 layout that no longer exists, and shows an obsolete shape.

## The fix

Correct the text to naima-tracker/naima-data/naima.json and regenerate the reference with `deno task docs`.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

documentation check: `deno task docs --check` passes, and docs/reference.md names the correct config path
