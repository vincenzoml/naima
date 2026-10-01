# Remove historical narrative from docs and user-facing text: docs/bootstrap.md 'History' section and docs/format.md's pre-format-1 layout story. Owner's order: docs describe what is, not how it came to be.

What has to be done, and how it will be known to be done.

- [ ]

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

U4 proof run: gesture performed. grep -n History develop/bootstrap.md returns nothing (exit 1, no matches) on main's head (commit 623fd87). docs/format.md also carries no pre-format-1 layout story (grep -ni 'pre-format-1|format 1|History' is empty). Confirmed fixed; leaving status for the evidence owner.
