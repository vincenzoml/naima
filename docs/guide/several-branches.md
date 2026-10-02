# Work on several branches at once

Several people or agents can work on one project at the same time without
stepping on each other, through git alone. Each piece of work has its own
[worktree](glossary.md#worktree) and its own [branch](glossary.md#branch)
([the rule](rules.md#one-worktree-per-piece-of-work)).

## Start a piece of work

```sh
naima open export-drops --as ada --name export-alpha --note "fixing the alpha channel"
cd ../project-worktrees/export-alpha
git add naima-tracker && git commit -m "Claim export-drops"
```

- `naima open` makes a second checkout in its own folder, on a new branch
  from the [trunk](glossary.md#trunk), and claims the item there. The branch
  is `<who>/<what>` (`ada/export-alpha`); the folder is `<what>` in the
  worktrees directory, `<project>-worktrees` beside the main checkout. A
  worktree or branch off this scheme, or a worktree with work and no claim,
  fails `naima check` ([the rule](rules.md#worktrees-and-branches-are-named-by-one-scheme-and-every-worktree-carries-a-claim)).
  Install the project's dependencies there before running anything.
- The first `naima` command in it fetches its own copy of Naima from the main
  checkout's, at the same locked commit.
- The claim is one file of this branch's own, saying what it works on; `naima claim` adds items.
  Others see it at once; nobody is locked out — several branches may claim
  one [item](glossary.md#item), and `claim` says who else holds it.

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
naima claim --preparing     # told when the trunk moves under the branch
naima release export-drops
naima pass "Fixed export of the alpha channel; proven by tests/export-keeps-alpha; layered PSD files not tried"
naima check
git add -A && git commit -m "Release the claim; session note"
git merge --no-edit main
```

- `naima release` drops this branch's claim. Run it here, not on the [trunk](glossary.md#trunk).
- `naima pass` writes a [session note](glossary.md#session-note): what
  changed, what is proven, and what was **not** verified.
- Merging the trunk into the branch first makes the final merge a
  [fast-forward](glossary.md#fast-forward). Resolve any conflict here, and
  run the checks again.

Then, on the trunk:

```sh
git merge --ff-only ada/export-alpha
naima prune --branch ada/export-alpha --write   # the worktree and the branch
```

`prune --branch` deletes a branch only when the trunk holds its commits, or
an `archive/<branch>` tag does: `--archive` makes the tag, for work set
aside rather than merged.

If `--ff-only` refuses, stop: the trunk moved. Merge it into the branch
again, on the branch ([the rule](rules.md#every-merge-to-the-trunk-is-a-fast-forward)).

## One holder at a time: resources

An item may be claimed by several branches; a **resource** may not. A
resource is something two sessions must never touch at once — the published
site, another repository's trunk, the release tags — and it is held by one
branch at a time. The resources are data, in naima.json:

```sh
naima plugin set coordination 'resources={"site":{"says":"the published site","role":"website-manager"}}'
```

Each one says what it is, and may name the [role](glossary.md#role) that
holds it. Then:

```sh
naima claim --resource site --note "publishing"   # refused, naming the holder, while another branch holds it
naima claims --resources                          # every resource: its holder, or free
naima release --resource site                     # done: another branch may take it
```

The resource is written in the branch's own claim file, beside its items, so
it is seen from every local branch exactly as an item claim is. A holder
whose branch is gone is listed by `naima prune`, and refused claims name it
too; a resource two branches hold at once — two claims made before either
saw the other — fails `naima check`.

A tool that touches a resource asks first: `naima claims --resources --json`
prints, for each one, its holders with their branch and claim id, so a
publish script can refuse unless the branch it runs on is the holder, and
record the claim id in what it publishes.

A role can be the one that holds a resource. A project declares its own roles
in the roles plugin's `roles` option — for example a website manager that
alone publishes the site, whose queue (`naima queue --role website-manager`)
lists the items of kind `site` everyone else files instead of publishing
themselves:

```sh
naima plugin set roles 'roles={"website-manager":{"title":"Website manager","owns":"the site: it alone publishes it","refuses":["publishing without the site claim"],"kinds":["site"],"types":[]}}'
naima new todos "Site: fix the install line" --set kind=site
```

## Two branches, one title

Two branches that open an item with the same title would make the same
folder. `naima new` looks at every other local branch first and picks a free
name (`…-2`). A branch on another machine, not fetched yet, is not seen, so
a collision is rarer, not impossible: git reports it at the merge.

## Claims left behind

```sh
naima prune            # claims naming a branch git no longer has, with the resources they hold
naima prune --write    # remove them; commit the deletions
```

Release someone else's claim by hand only when nothing is being worked on
there and nothing on that branch is left unmerged.

## The full procedure

What an agent follows, with every reason: [opening a worktree](../agents/opening-a-worktree.md),
[closing a worktree](../agents/closing-a-worktree.md),
[worktree isolation](../agents/worktree-isolation.md).
