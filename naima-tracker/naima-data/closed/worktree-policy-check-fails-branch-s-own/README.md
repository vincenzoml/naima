# worktree-policy check fails a branch's own gate over a sibling worktree's missing claim

worktree-policy check fails a branch's own gate over a sibling worktree's missing claim

`naima check` / `deno task verify` runs the worktree-policy check, which
scans every worktree. A sibling worktree with commits ahead of the trunk and
no claim is reported as a problem even when checking an unrelated branch:
landing evidence-close-2 failed its gate over "worktree …/u15-entry-check
carries no claim", a worktree it has nothing to do with.

A gate must judge its own tree: one worker's missing claim must not block
every other branch from landing. Fix: in a branch's own check, a sibling
worktree's missing claim is a note (naming the worktree); a problem only for
the worktree being checked (self). `naima check --all-worktrees` (or the
coordinator's view) still reports every one as a problem, so the coordinator
sees it.

Also verify and document: a branch that only files items (no item to claim)
passes if it has a session note (`naima pass`) — make sure that path works
and is documented for filers.
