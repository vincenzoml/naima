# Field access goes through an untyped index signature

Consolidated review 2026-09-30, id `R-42` (see the linked review item for
the full review). Severity as scored by the review: **medium**,
status **CONFIRMED**.

## Where

`src/core/types.ts:21, and roughly 90 call sites`

## What is wrong (the failure)

A typo like item.fixedOn misspelled as item.fixdOn compiles cleanly because Meta's index signature accepts any string key, silently returning undefined instead of a type error.

## The fix

Enable noPropertyAccessFromIndexSignature in tsconfig/deno.json, and add a typed field<T>(item, def) accessor used at the ~90 call sites instead of direct property access.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

typecheck gate: deno check fails on a misspelled field-name access once the accessor and the compiler flag are in place
