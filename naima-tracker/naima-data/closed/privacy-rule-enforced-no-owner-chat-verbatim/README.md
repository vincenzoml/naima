# Privacy rule, enforced: no owner-chat verbatim in items; attachments need explicit consent

The chat between owner and agent is private; nothing from it is copied into the repository without explicit consent; owner-shared files become attachments only with an explicit yes. Today this is a convention an agent can forget.

Done: reporting-and-triage states the rule in those words; a check can flag an attachment added without a recorded consent marker; the rule is `enforced`, not `convention`, in `naima rules`.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u7-privacy

Implemented on claude/u7-privacy: the privacy plugin (naima attach with --consent or --own; checks attachment-consent and secrets); the rules page marks the rule enforced; the rule is filed as rules/owner-s-chat-stays-private. Left:

- [ ] once the lock moves to a commit with the privacy plugin, naima set owner-s-chat-stays-private enforcedBy=attachment-consent (the locked rules check refuses a check it does not know, so it cannot be set before).
