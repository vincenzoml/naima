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

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/evidence-close-5

Checked after this session's closings: 61 of 64 linked items closed, 1 withdrawn, 1 wontfix (settled, duplicate of an already-fixed bug) — effectively all done but one. The remaining blocker is features/host-leakage-installed-program-directory-holds-only, which this session reopened: its linked proving test verified the now-removed dist-branch mechanism (src/dist.test.ts no longer exists), not the copy-on-install approach that actually shipped (aebd210). Not a proof. This umbrella stays open until that item gets a real proving test and closes.

### 2026-10-01 — triage agent, on claude/effort-triage

Read the item and its 64 linked items: an index/umbrella that is effectively closed out already (61 closed, 1 withdrawn, 1 wontfix); remaining work is tracking one blocker (features/host-leakage-installed-program-directory-holds-only), not new code.

### 2026-10-01 — Vincenzo Ciancia, on claude/final-sweep

Final sweep (claude/final-sweep): its Done line (every fix and design decision filed and linked) holds — 64 linked items, none untriaged; two are open: the host-leakage feature, now proven by tests/host-leakage-copy-install-installed-program-holds, and the purpose page, waiting on the owner's read. Whether a standing index should be closed is the evidence owner's call.

### 2026-10-01 — status sync agent, on claude/status-sync

Status sync: done. All 64 linked items are closed, withdrawn, done or wontfix except one, which is owner-only: todos/document-naima-s-purpose-requirements-philosophy (waits on the owner's go to start, per AGENTS.md, and its own proving gesture is runBy human).
