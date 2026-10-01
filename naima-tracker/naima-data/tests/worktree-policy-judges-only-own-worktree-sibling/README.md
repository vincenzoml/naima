# worktree-policy judges only its own worktree, a sibling's missing claim is a note not a problem (test/plugins/coordination/worktrees.test.ts)

The gesture that proves it, step by step, and what a pass looks like.

## Result

What was seen, when, and by whom.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/evidence-close-4

deno test -A test/plugins/coordination/worktrees.test.ts: 6 passed, 0 failed, including 'the policy check fails a worktree or a branch off the scheme, and an unclaimed worktree with work on it' — a sibling worktree's missing claim is a note on another branch's own check, a problem only on its own. Fixed by c61a0ce.
