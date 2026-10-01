# `naima init` prints a hint naming a plugin type instead of a real command

Consolidated review 2026-09-30, id `R-47` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **CONFIRMED**.

## Where

`src/core/cli.ts:113`

## What is wrong (the failure)

The core's own init hint text is hard-coded to "naima new todos ...", which both names a specific plugin's type from core code and is wrong to print when the todos type is not loaded.

## The fix

Print the first creatable type actually found in the loaded registry, instead of a hard-coded plugin type name.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

regression test: with a project configuration that does not load the todos type, `naima init`'s printed hint still names a type that really exists
