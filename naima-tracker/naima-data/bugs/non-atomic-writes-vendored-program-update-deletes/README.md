# Non-atomic writes, and a vendored program update deletes the program before the new checkout lands

Consolidated review 2026-09-30, id `R-23` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **PLAUSIBLE**.

## Where

`src/core/item.ts:37; src/core/config.ts:83; src/core/format.ts:52; src/plugins/verifier/index.ts:87; src/core/program.ts:143-145`

## What is wrong (the failure)

An interrupted write (crash, kill -9) truncates meta.json instead of leaving the old or new content intact. A failed checkout during a vendored update can leave no program directory at all.

## The fix

Introduce one writeJsonAtomic helper (write to a temp file, then rename) used at every write site including migrate, and check out a vendored update into a sibling directory before swapping it into place.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

regression test: killing the process mid-write leaves meta.json either fully old or fully new, never truncated; a failed vendored checkout leaves the previous program directory intact
