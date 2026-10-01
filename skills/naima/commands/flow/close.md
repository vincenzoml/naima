---
description: Before merging · the eight steps
---
Flow: [closing a worktree](../../../../docs/flows/closing-a-worktree.md). This is
the sequence, not the reasoning; where the two disagree, the page wins.

1. **Every fix names its gesture**: a test item linked `verifies`, with `runBy`
   (and `humanBecause` if a person's).
2. **Triage what is left**: `naima triage missing`; set `effort` where you know it.
3. **Release claims from the worktree**: `naima release <item>...`; commit the deletion.
4. **Session note**: `naima pass "what changed, what is proven, what is left"`.
5. **Run the gates and read what breaks**, including `naima check`.
6. **Merge the trunk into the branch**; resolve here; run the gates again.
7. **Hand over**: `git merge --ff-only <branch>`. If it refuses, STOP.
8. **Only then** `git worktree remove <path>`.

Never close the branch's own items: fixed is not resolved.
