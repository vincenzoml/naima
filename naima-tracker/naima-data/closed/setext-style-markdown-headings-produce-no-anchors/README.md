# Setext-style markdown headings produce no anchors for the links-resolve check

Consolidated review 2026-09-30, id `R-34` (see the linked review item for
the full review). Severity as scored by the review: **low**,
status **CONFIRMED**.

## Where

`src/plugins/docs/index.ts:223-238`

## What is wrong (the failure)

A heading written as underlined text (=== or --- under a line) instead of a leading #, gets no anchor, so a valid relative link to it fails the links-resolve check.

## The fix

Recognise === and --- underline syntax as headings when generating anchors.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `misc.ts`, attached in `attachments/`.


## Done

regression test: a markdown file with a setext heading is linkable, and links-resolve passes against it, named after case R14 in plugins-repro/misc.ts
