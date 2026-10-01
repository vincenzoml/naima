# A property's `holds` status survives a change to the property, verifier, model path or options

Consolidated review 2026-09-30, id `R-04` (see the linked review item for
the full review). Severity as scored by the review: **high**,
status **CONFIRMED**.

## Where

`src/plugins/verifier/index.ts:140-146`

## What is wrong (the failure)

After `set property="some gamma"`, the status stays holds, `naima check` is green, and the stale property can still close a bug.

## The fix

In the property-evidence check, compare run.property, run.verifier and run.model, plus a stored options hash, against the item's current meta.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `ver.ts`, `ver.out`, attached in `attachments/`.


## Done

regression test: changing a verified property's `property`/`verifier`/`model`/options after it holds flips its status away from holds and `naima check` reports it, named for case R4 in plugins-repro/ver.ts
