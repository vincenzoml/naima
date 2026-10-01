# An adapter's out-of-contract verdict silently erases the property's status

Consolidated review 2026-09-30, id `R-06` (see the linked review item for
the full review). Severity as scored by the review: **medium**,
status **CONFIRMED**.

## Where

`src/plugins/verifier/index.ts:79-91`

## What is wrong (the failure)

A `{verdict:"pass"}` result (outside the four allowed verdicts) writes a meta.json with no status field at all, and every later `naima check` fails. A thrown non-Error value gives `output: undefined`.

## The fix

Validate the adapter's result: anything outside the four verdicts, or a result without a string output, becomes `error`. Use String(e) to render a thrown non-Error.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `ver.ts`, `ver.out`, attached in `attachments/`.


## Done

regression test: an adapter returning an out-of-contract verdict, or throwing a non-Error, produces a property with status `error` and a readable output, not a status-less meta.json, named after case R6 in plugins-repro/ver.ts
