# Derived timeline view (`naima view timeline`)

'When did this gate open, when did that epic finish' invites a second, storage-backed event log that can disagree with the items and look authoritative while being wrong.

Done: the view derives each event from the items and git with nothing stored — a gate opened is its first item reported, a gate passed is its last item resolved, an epic the same way, a release is a version tag, a session is its note; undated things are counted at the foot, never placed at a guess; only what cannot be derived (a decision, a build handed out, a policy, an outside fact) needs a record, one file per event.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u21-derived-views

Built on claude/u21-derived-views, commit 2766a4f, in the coordination plugin (timeline.ts) with naima event for records in events/. Resolution date is closedOn, else fixedOn; a passed test with neither is undated, counted at the foot. Also a tab of naima ui; ui views gained an order so metrics stays first. Proof: tests/timeline-view-derived-events-undated-counted-records.
