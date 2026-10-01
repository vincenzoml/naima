# Epics, and milestones as a dated or version-tagged gate: restore as a HIGH-priority regression

Epics and milestones were in continuous use in a comparable method and were dropped in translation; this is filed as a regression to restore, not a new idea.

An audit corrects the shape before restoring it: epics are the heavily used part there (19 defined, carried by 89 items, named in 97 commit messages and 25 session notes in 30 days) and deserve a real type or a declared list of values with a view; milestones are dead as a field there (0 defined, 0 items) and alive only as version tags drawn on a timeline — so a milestone should be modelled as a gate with a date, or derived from a version tag, not shipped as its own field.

Done: epics exist as a type or a declared list of values (each with a title and description, extending the classifier-list item); a gate can carry a date; a derived timeline view draws version tags as milestones; items can carry an epic; a view groups by epic; documented.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

U4 proof run: withdrawn as a duplicate of features/epics-milestones-gates-owner-can-create-by, which the (a) epics/gates branch ships. Leaving status as-is for the evidence owner to close.
