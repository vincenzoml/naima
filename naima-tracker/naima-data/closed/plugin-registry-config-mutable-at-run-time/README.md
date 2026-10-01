# The plugin registry and config are mutable at run time

Consolidated review 2026-09-30, id `R-48` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **CONFIRMED**.

## Where

`src/core/types.ts:214-227; src/core/context.ts:26-47`

## What is wrong (the failure)

Any plugin can delete or overwrite another plugin's command, type or field after buildRegistry has run, because nothing freezes the registry.

## The fix

Object.freeze the registry plus a ReadonlyMap wrapper after buildRegistry finishes; full capability scoping between plugins is left to the design decision on external plugins (D-10).

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

regression test: a plugin attempting registry.commands.delete(...) or similar mutation after load throws instead of silently succeeding
