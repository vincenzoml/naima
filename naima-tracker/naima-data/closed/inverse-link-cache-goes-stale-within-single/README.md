# The inverse-link cache goes stale within a single run

Consolidated review 2026-09-30, id `R-41` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **CONFIRMED**.

## Where

`src/core/base.ts:42,166 and saveMeta`

## What is wrong (the failure)

After unlink or set in the same process run, the inverse-link map used by later reads in that run is not invalidated, so a just-removed link can still appear.

## The fix

Route every write through a repo method that invalidates the cache, and drop the manual reload() calls scattered at call sites.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

regression test: unlinking two items and then immediately reading either one's links in the same run shows the link is gone, without a manual reload
