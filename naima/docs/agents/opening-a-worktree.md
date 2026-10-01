# Opening a worktree

Starting a piece of work. Four steps; the requirement they obey is
[worktree isolation](worktree-isolation.md), and the rules they apply are on
[the rules page](../guide/rules.md).

## 1. The work has an item

If it has none, open one first ([reporting and triage](reporting-and-triage.md)).
A fix with no trace is forgotten, and next time it is diagnosed from scratch.

## 2. Its own worktree, its own branch

Name the branch `<who>/<what>`: who works (an agent's role or name) and on
what, in a few words. A checked naming policy is
[planned](../planned.md#worktree-names-and-claim-files).

```sh
git worktree add -b <who>/<what> <worktrees-dir>/<what>
cd <worktrees-dir>/<what>
```

A fresh checkout has no installed dependencies: install them before running
anything.

## 3. Claim what you work on, before you start

From inside the [worktree](../guide/glossary.md#worktree), never from the [trunk](../guide/glossary.md#trunk):

```sh
naima claim <item> [<item>...] --note "why"
```

It writes one [claim file](../guide/glossary.md#claim-file),
`naima-tracker/naima-data/claims/<uuid>.json`, in this worktree and
stops: nothing staged, nothing committed, no other branch touched. Commit it
with the work. Several branches may claim one [item](../guide/glossary.md#item), and one branch several —
`claim` says who else holds it.

## 4. A scratchpad is not a tracker

A scratch file for what you are doing right now (for example an untracked
`WIP.md`) is fine, and goes with the worktree. A defect, a task, a
verification or a rule written there is lost with it: those are items.
