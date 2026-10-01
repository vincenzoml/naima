# The launcher grants unrestricted `--allow-env`

Consolidated review 2026-09-30, id `R-40` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **CONFIRMED**.

## Where

`src/launcher.ts:50`

## What is wrong (the failure)

The program can read every environment variable on the machine, including unrelated secrets, when it only ever needs a handful of NAIMA_*/GIT_* variables plus HOME and PATH.

## The fix

Grant a named allow-list (HOME, PATH, the NAIMA_* and GIT_* variables) instead of unrestricted --allow-env, and document the list.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

regression test: the launcher's Deno permission flags name an explicit env allow-list, and a probe for an unrelated environment variable fails under it
