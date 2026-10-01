# The example regex verifier adapter counts a phantom last line

Consolidated review 2026-09-30, id `R-32` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **CONFIRMED**.

## Where

`src/plugins/verifier/adapters/example-regex.ts:25-28`

## What is wrong (the failure)

A rule like "never match ^$" is violated on a perfectly normal file because splitting on newline produces a trailing empty string; CRLF line endings also keep their trailing \r, corrupting every match.

## The fix

Strip a single trailing newline before splitting: text.replace(/\r?\n$/,"").split(/\r?\n/).

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `ver.ts`, attached in `attachments/`.


## Done

regression test: a normal file with a trailing newline and CRLF line endings no longer triggers a phantom violation of "never ^$", named after case R10 in plugins-repro/ver.ts
