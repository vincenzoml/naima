# Work on several branches at once

Several people or agents can work on one project at the same time without
stepping on each other, through git alone. Each piece of work has its own
[worktree](glossary.md#worktree) and its own [branch](glossary.md#branch)
([the rule](rules.md#one-worktree-per-piece-of-work)).

## Start a piece of work

```sh
git worktree add -b ada/export-alpha ../worktrees/export-alpha
cd ../worktrees/export-alpha
naima claim export-drops --note "fixing the alpha channel"
git add naima-tracker && git commit -m "Claim export-drops"
```

- `git worktree add` makes a second checkout in its own folder, on a new
  branch. Install the project's dependencies there before running anything.
- The first `naima` command in it fetches its own copy of Naima from the main
  checkout's, at the same locked commit.
- `naima claim` writes one file of this branch's own, saying what it works on.
  Others see it at once; nobody is locked out — several branches may claim
  one item, and `claim` says who else holds it.

## See who is doing what

```sh
naima claims        # every claim, from every local branch
naima summary       # the same, with the last session notes
```

The views read every local branch and every worktree's folder, uncommitted
files included. A branch that exists only on someone else's machine is seen
once it is fetched and checked out.

## Finish a piece of work

From inside the worktree:

```sh
naima release export-drops
naima pass "Fixed export of the alpha channel; proven by tests/export-keeps-alpha; layered PSD files not tried"
naima check
git add -A && git commit -m "Release the claim; session note"
git merge --no-edit main
```

- `naima release` drops this branch's claim. Run it here, not on the trunk.
- `naima pass` writes a [session note](glossary.md#session-note): what
  changed, what is proven, and what was **not** verified.
- Merging the trunk into the branch first makes the final merge a
  [fast-forward](glossary.md#fast-forward). Resolve any conflict here, and
  run the checks again.

Then, on the trunk:

```sh
git merge --ff-only ada/export-alpha
git worktree remove ../worktrees/export-alpha
```

If `--ff-only` refuses, stop: the trunk moved. Merge it into the branch
again, on the branch ([the rule](rules.md#every-merge-to-the-trunk-is-a-fast-forward)).

## Two branches, one title

Two branches that open an item with the same title would make the same
folder. `naima new` looks at every other local branch first and picks a free
name (`…-2`). A branch on another machine, not fetched yet, is not seen, so
a collision is rarer, not impossible: git reports it at the merge.

## Claims left behind

```sh
naima prune            # claims naming a branch git no longer has
naima prune --write    # remove them; commit the deletions
```

Release someone else's claim by hand only when nothing is being worked on
there and nothing on that branch is left unmerged.

## The full procedure

What an agent follows, with every reason: [opening a worktree](../agents/opening-a-worktree.md),
[closing a worktree](../agents/closing-a-worktree.md),
[worktree isolation](../agents/worktree-isolation.md).
