# Consolidated review 2026-09-30

A full-repository code review, merged from four separate passes (core
correctness, plugin correctness, extensibility, clean code) plus a dedicated
host-leakage investigation, conducted 2026-09-30 against `main` at commit
`4f11b21`. It produced 15 owner-facing design decisions and 48 fixes.

## What this item is

An anchor. Every item filed from the review — each of the 48 fixes (`R-01`
through `R-48`, filed as bugs or todos) and each of the 15 design decisions
(`D-01` through `D-15`, filed as features) — links back to this one, so the
whole review can be found from any one of its parts, and so the original
consolidated documents are attached in one place instead of copied into every
item.

## Attachments

- `REVIEW.md`: the consolidated review itself (verdict, the 15 design
  decisions with today's behaviour and options, and the 48 fixes table).
- `DECISIONS.md`: the owner's chosen option for every design decision;
  authoritative over REVIEW.md's own recommendation where they differ.

## Done

This item is done when every fix and every design-decision feature from the
review has been filed and linked to it, and stays open as a standing index;
it is not itself something to "fix".
