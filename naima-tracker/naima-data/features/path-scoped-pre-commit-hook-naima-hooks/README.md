# Path-scoped pre-commit hook (`naima hooks install`)

A check that runs only in a late flow finds a defect days late; a hook that runs everything on every commit gets skipped.

Done: `naima hooks install` sets the hooks path once per clone (worktrees inherit it); the pre-commit hook runs only the checks whose declared paths intersect the staged files; `--no-verify` is allowed and documented; a test shows the hook passing over an unrelated commit and failing over a relevant one.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u14-commit-hook

core.hooksPath is a write to .git/config, outside the launcher's write fence. Kept, because it is git that writes it — the one program the launcher runs — through `git config`, one key, local to the clone and reversible with `naima hooks uninstall`; the hook script itself is written inside the fence, under naima-data/hooks/, and tracked. The alternative, a hook git runs without any config write, does not exist: git looks only in .git/hooks or core.hooksPath, and .git/hooks is not tracked. Not installed in this repository yet: the locked program does not carry the plugin until the lock moves past this branch.

### 2026-10-01 — Vincenzo Ciancia, on claude/u14-commit-hook

Landed in commit fff5255063e643409976291b7d85d3294a5b177b on claude/u14-commit-hook (the commits field is not declared for features by the locked program; set it once the lock moves).
