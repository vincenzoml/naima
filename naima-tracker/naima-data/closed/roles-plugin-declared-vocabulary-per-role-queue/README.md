# Roles plugin: declared vocabulary and a per-role queue view

Six jobs are described in one flow page only; `kind` is a free string tied to nothing; no outward role exists.

Done: a `roles` plugin declares a role vocabulary (owner, coordinator, lead developer, implementer, tester, evidence owner, filer, verification engineer, release manager, documentarian, announcer, community steward, business), each with what it owns and refuses, as manifest data; a role-to-kinds map assigns items to role queues; `naima queue --role <r>` shows a role's queue; documented; a test covers the view.

Lower priority than porting the refusals into flow pages first (see the companion item): this item is presentation, not the safety property.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u18-roles

Built on claude/u18-roles, commit 7b59b86: a roles plugin declaring a roles extension point with the thirteen default roles; options.roles adds or replaces one. The kinds the roles take extend the trackers' kind field; this tracker's kinds task, feature and defect are now notes, no role taking them. naima queue --role lives in the gates plugin's queue and reads the role's queue() through the registry; with no gate it covers every open item, not only gated ones.
