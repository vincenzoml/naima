# Helper functions are duplicated between the launcher and the CLI

Consolidated review 2026-09-30, id `R-43` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **CONFIRMED**.

## Where

`src/launcher.ts:25,28,34; src/core/cli.ts:78,88,138; src/core/program.ts:49`

## What is wrong (the failure)

`--data` is parsed by two independent, slightly different implementations, one in the launcher and one in the CLI, which can silently drift apart.

## The fix

Export real, the data-flag parser, programOf and short once from a shared module, and have both call sites import it.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

regression test: a --data value that one implementation handled differently (e.g. a relative path) now behaves identically whether parsed by the launcher or the CLI
