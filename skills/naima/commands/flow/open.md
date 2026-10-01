---
description: Start a piece of work · item, worktree, claim
argument-hint: <what-you-are-doing> [item ...]
---
Flow: [opening a worktree](../../../../docs/flows/opening-a-worktree.md). Where
this checklist and the page disagree, the page wins.

1. **The work has an item.** If not: `naima new <type> "<what happened>"`,
   then triage it.
2. **Its own worktree:** `git worktree add -b <who>/$1 <worktrees-dir>/$1`,
   dependencies installed.
3. **Claim, from inside the worktree:** `naima claim <item>... --note "why"` —
   one file, on this branch; commit it with the work.
4. **A scratchpad is not a tracker.** Defects, tasks and verifications are items.

Never write into another checkout, and never commit on the trunk:
[worktree isolation](../../../../docs/flows/worktree-isolation.md).
