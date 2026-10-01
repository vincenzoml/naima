# Adopt existing boards without loss (`naima adopt`)

Every project that adopts Naima already has a TODO.md or issues; retyping them loses reports.

Done: adoption runs in phases — boundary markers proposed and reviewed first (the diff deletes zero lines), then a mechanical split; board and item prose round-trip byte for byte; a re-run adds only what is missing and never overwrites; an audit re-reads every historical version of the source file and reports anything not carried over; links and gates are proposed only from hard evidence (a shared commit hash and shared wording), everything else printed for a person to decide.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u20-adopt-boards

Built on claude/u20-adopt-boards, commit 34c7b55: the adopt plugin (propose, split, audit, links; each a dry run until --write; the source never deleted). Proof: tests/naima-adopt-suite-markers-only-add-byte. Issue lists are read only as markdown; no tracker API.
