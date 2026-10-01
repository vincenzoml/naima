# Opening a worktree

Starting a piece of work. Four steps, the second and third one command; the requirement they obey is
[worktree isolation](worktree-isolation.md), and the rules they apply are on
[the rules page](../guide/rules.md).

## 1. The work has an item

If it has none, open one first ([reporting and triage](reporting-and-triage.md)).
A fix with no trace is forgotten, and next time it is diagnosed from scratch.

**Spec first.** If the item is linked `specified-by` a spec, read its current
version (`naima spec`) before writing code. If the work changes what the spec
says, change the spec first — `naima spec revise <spec>` opens the next version
as a draft — and build once it is `current`. If the item has a requirement it
`satisfies`, the proof you file for it also `verifies` the requirement.

## 2. Its own worktree, its own branch

```sh
naima open <item> [<item>...] --as <who> [--name <what>] --note "why"
cd <worktrees-dir>/<what>
```

The branch is `<who>/<what>`: who works (an agent's role or name) and on
what, in a few words, each part lowercase letters, digits, dots and dashes;
`<what>` defaults to the first item's slug, and `<who>` to the coordination
plugin's `who` option. The worktree is the folder `<what>` of the worktrees
directory, `<main checkout>-worktrees` beside the main checkout unless the
plugin's `worktrees` option says otherwise; the branch starts from the
[trunk](../guide/glossary.md#trunk). `open` refuses a name off the scheme, a
branch that exists and a folder that exists, before it touches anything. The
check `worktree-policy` fails a worktree or a branch off this scheme
([the rule](../guide/rules.md#worktrees-and-branches-are-named-by-one-scheme-and-every-worktree-carries-a-claim)).

A fresh checkout has no installed dependencies: install them before running
anything.

## 3. Claim what you work on, before you start

`open` has already claimed its items, in the new worktree. To claim more,
from inside the [worktree](../guide/glossary.md#worktree), never from the trunk:

```sh
naima claim <item> [<item>...] --note "why"
```

It writes one [claim file](../guide/glossary.md#claim-file),
`naima-tracker/naima-data/claims/<uuid>.json`, in this worktree and
stops: nothing staged, nothing committed, no other branch touched. Commit it
with the work. Several branches may claim one [item](../guide/glossary.md#item), and one branch several —
`claim` says who else holds it. A worktree made by hand with `git worktree
add` still carries a claim: the check fails one whose commits the trunk lacks
and that holds none.

## 4. A scratchpad is not a tracker

A scratch file for what you are doing right now (for example an untracked
`WIP.md`) is fine, and goes with the worktree. A defect, a task, a
verification or a rule written there is lost with it: those are items.

## Safety rules

- **Every worktree carries a claim.** Enforced by the check `worktree-policy`:
  a worktree made by hand with `git worktree add` still fails it if it holds
  no claim file.
- **A worktree and its branch are named by one scheme.** Enforced by the same
  check: a name off the `<who>/<what>` scheme fails.
- **`open` never reuses a name or a branch already in use.** Enforced:
  `naima open` refuses a branch that exists and a folder that exists, before
  touching either.
