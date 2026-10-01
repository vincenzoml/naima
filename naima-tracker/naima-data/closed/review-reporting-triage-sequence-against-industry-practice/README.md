# Review the reporting-to-triage sequence against industry practice

Is the sequence (filed first — from chat, adjusted, or directly as a file by the reporter — then triaged, by an agent) industry grade? All flows are asked to be reviewed the same way.

Done: reporting-and-triage.md and the other flow pages are compared against common industry triage practice; gaps are either fixed or filed as their own items; the comparison and its verdict are recorded on this item.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/d2-people-docs

Verdict: close to industry grade, with one real gap, filed separately.

Compared against common practice (ITIL incident triage, standard bug-tracker
workflows): intake before investigation, severity/impact scored apart from
priority, confidence marked apart from the fix, deduplication by link rather
than copy, an explicit instrument for who can prove a fix (runBy), redaction
and consent before anything private is attached, and a close that refuses on
stale or refuting evidence are all present and match or exceed common
practice (triage happening in the same sitting as filing is tighter than
most SLA-based shops, where triage is a later, separate step).

One gap: no view surfaces how long an item has sat at its priority with
nobody holding it, so a `now` item can go quietly stale. Filed as
todos/surface-how-long-now-priority-item-has.

No other gap found worth its own item: deferred/parked items with no stated
reopening condition is already tracked
(todos/deferral-reason-becomes-check-parked-wontfix-must), and Naima's
immediate, continuous triage makes a fixed SLA per priority level the wrong
fit for an agent-run project, not a missing one.
