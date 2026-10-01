# Announceability computed from shipped, documented and verified

Shipped features name their docs and nothing more; publicity has nothing true to draw from.

Done: features carry `audience` (user/internal) and `major` (boolean); an `announce` plugin derives 'announceable' = user-facing, shipped, documented and verified by an item whose proof is a person's gesture or a passed end-to-end test; `naima announce` lists announceable features since a gate or date as release-note source; a check fails when site or README copy (configurable paths) names a feature that is not announceable; an announcer flow page states what the role refuses.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u18-roles

Built on claude/u18-roles, commit 7b59b86: an announce plugin. The field is facing (user|internal), not audience, because the rules plugin already stores audience on rules. Checked means a passed proof with runBy human or agent-hands, or evidenceKind owner-gesture (options checkedBy, checkedEvidence); naima announce takes --since <date> and --gate <gate>, the two readings of since a gate or date. The copy check reads README.md by default (option copy) and matches a feature's label or full title; README passes today. The announcer flow page is naima/docs/agents/announcer.md; release stage 7 hands to it.
