# Hand edits bypass write-hook invariants; `naima check` must re-assert them

Invariants held only by write hooks (a property holds only through a run; no closing one's own claims) are not re-asserted by `naima check`, so a hand edit of `meta.json` escapes them.

Done: each write hook that protects an invariant gets a check counterpart; a test edits `meta.json` by hand and sees `naima check` fail.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u10-proof-integrity

Fixed on claude/u10-proof-integrity. Each write hook was sorted by what it protects. Hooks that protect a state now have a check counterpart: holds-only-by-verify and property-reopens-when-changed are covered by property-evidence (already there; now pinned by a hand-edit test), and no-closing-own-claims is covered by the new closed-not-claimed check in the coordination plugin. Hooks that guard a move or fill in a value have no state to re-assert: status-moves, notes-append-only, triage-stamps-its-date, planning-stamps. epic-status is already covered by the epics check. Documented in the rules, the glossary, the plugin contract and the agents' triage page.

### 2026-10-01 — Vincenzo Ciancia, on claude/u10-proof-integrity

Correction to the note above: epic-status was not covered by the epics check. It now is: the epics check reports an epic whose status differs from the one its items give it (test/plugins/epics/epics.test.ts).
