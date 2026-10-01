# The dependency-rule test (`src/arch.test.ts`) enforces less than it claims

Consolidated review 2026-09-30, id `R-20` (see the linked review item for
the full review). Severity as scored by the review: **medium**,
status **CONFIRMED**.

## Where

`src/arch.test.ts:21-28,43-58`

## What is wrong (the failure)

The test misses side-effect imports, template-literal import(), and createRequire; it never scans plugins living outside src/; and nothing checks that core names no plugin vocabulary.

## The fix

Use a module-graph scan (`deno info --json`), widen the scope to every plugin location, and add a "no plugin names in src/core" assertion.

## Evidence

Diagnosed: read in the code as certain, not run as a script.

No repro script; see the file:line evidence above.


## Done

regression test: a synthetic side-effect import or createRequire() escape hatch that violates the dependency rule is caught by the widened arch test
