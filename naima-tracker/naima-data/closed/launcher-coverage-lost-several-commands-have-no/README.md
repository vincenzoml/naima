# Launcher coverage is lost, and several commands have no test at all

Consolidated review 2026-09-30, id `R-19` (see the linked review item for
the full review). Severity as scored by the review: **medium**,
status **CONFIRMED**.

## Where

`src/distribution.test.ts:29; zero-hit lines in src/core/base.ts, src/core/cli.ts:193-203, src/plugins/triage/index.ts`

## What is wrong (the failure)

`program.ts` reports 35% coverage because subprocess coverage maps to deleted temp paths, hiding the real number; `list`, `unlink`, `view`, `types` and `help` have no test at all.

## The fix

Run the distribution tests from a git worktree (or rewrite the lcov paths so they resolve), and add one test per untested command, plus property tests for slugify, anchors, field round-trips and migrate.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `cov.txt`, attached in `attachments/`.


## Done

coverage gate: `list`, `unlink`, `view`, `types` and `help` each have at least one passing test, and program.ts coverage reflects real execution, evidence in cleancode/cov/
