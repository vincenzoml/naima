# Path-scoped pre-commit hook (`naima hooks install`)

A check that runs only in a late flow finds a defect days late; a hook that runs everything on every commit gets skipped.

Done: `naima hooks install` sets the hooks path once per clone (worktrees inherit it); the pre-commit hook runs only the checks whose declared paths intersect the staged files; `--no-verify` is allowed and documented; a test shows the hook passing over an unrelated commit and failing over a relevant one.
