# Roles plugin: declared vocabulary and a per-role queue view

Six jobs are described in one flow page only; `kind` is a free string tied to nothing; no outward role exists.

Done: a `roles` plugin declares a role vocabulary (owner, coordinator, lead developer, implementer, tester, evidence owner, filer, verification engineer, release manager, documentarian, announcer, community steward, business), each with what it owns and refuses, as manifest data; a role-to-kinds map assigns items to role queues; `naima queue --role <r>` shows a role's queue; documented; a test covers the view.

Lower priority than porting the refusals into flow pages first (see the companion item): this item is presentation, not the safety property.
