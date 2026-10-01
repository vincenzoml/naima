# The generated reference embeds the current project's configured gates

Consolidated review 2026-09-30, id `R-39` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **CONFIRMED**.

## Where

`src/plugins/gates/index.ts:140-149,176; src/plugins/docs/index.ts:142-206`

## What is wrong (the failure)

Editing a project's own gates in naima.json changes what `naima docs` generates for the program-level reference, so deno task verify breaks on an ordinary project config change, and each project ships a different "program" reference.

## The fix

Render configured gates in a separate, project-specific section of the reference, or leave project-configured gates out of the generated program reference entirely.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

regression test: changing a project's naima.json gates does not change what `naima docs --check` expects of docs/reference.md
