# A relative `source` path in naima.json is accepted

Consolidated review 2026-09-30, id `R-29` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **PLAUSIBLE**.

## Where

`src/core/config.ts:33; src/core/program.ts:113`

## What is wrong (the failure)

A relative source path resolves against whatever the current working directory happens to be at fetch time, so later fetches from a different directory silently fail or resolve to the wrong place.

## The fix

Reject a local source path that is not absolute, at the point naima.json is parsed.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

regression test: naima.json with a relative filesystem source is refused with a clear error instead of being written or used
