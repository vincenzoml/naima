# No lint or formatter wired into the toolchain

Consolidated review 2026-09-30, id `R-17` (see the linked review item for
the full review). Severity as scored by the review: **medium**,
status **CONFIRMED**.

## Where

`deno.json; the verify task; .github/workflows/ci.yml`

## What is wrong (the failure)

12 lint errors and all 44 source files unformatted are currently invisible to `deno task verify` and CI; there is also an indentation slip at src/plugins/beta-markers/index.ts:120-121, and 70 lines over 160 characters.

## The fix

Add `fmt` and `lint` blocks to deno.json, add both to `verify`, reformat the codebase in one commit, and fix the 11 require-await lint hits.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `lint.txt`, `fmt.txt`, attached in `attachments/`.


## Done

gate check: `deno task verify` runs `deno lint` and `deno fmt --check` and both pass, evidence in cleancode/lint.txt and cleancode/fmt.txt
