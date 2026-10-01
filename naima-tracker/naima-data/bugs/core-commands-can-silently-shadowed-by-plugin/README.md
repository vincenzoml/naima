# Core commands can be silently shadowed by a plugin command, and some kinds skip collision checks

Consolidated review 2026-09-30, id `R-21` (see the linked review item for
the full review). Severity as scored by the review: **medium**,
status **CONFIRMED**.

## Where

`src/core/cli.ts:212-229; src/core/registry.ts`

## What is wrong (the failure)

A plugin command named `update`, `carry`, `guide` or `init` loads successfully and can never run, with no error. Two checks named `links` from different plugins both run silently and cannot be told apart in output.

## The fix

Reserve the core command names in buildRegistry so a plugin cannot register over them, and extend collision checking to checks, summary sections and rank terms.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

regression test: a plugin declaring a command named `init` fails to load with a collision error, and two checks named `links` are rejected the same way
