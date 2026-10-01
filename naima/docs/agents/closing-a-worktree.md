# Closing a worktree

Everything that has to be true before a branch is merged, in the order that
makes each step possible. Several steps cannot be done from the [trunk](../guide/glossary.md#trunk)
afterwards, and the first is the one most often skipped.

The rules it applies are on [the rules page](../guide/rules.md#branches-and-worktrees);
this page is the procedure. Preparing the branch is the developer's work. Deciding that it may enter the
trunk is a separate call: whoever wrote the code does not also decide it
ships.

## 0. Say the branch is being prepared

```sh
naima claim --preparing
```

From then on `naima check` notes every commit the trunk takes that the
branch lacks — merge it in again (step 6) — and names each one the trunk's
reflog records as committed on the trunk directly, outside the flow
([worktree isolation](worktree-isolation.md#2-nobody-commits-on-the-trunk-while-branches-are-being-prepared)).
While the mark is set, releasing the last item (step 3) keeps the claim
file, empty, to hold it; `naima claim --not-preparing` drops the mark and
removes that file, just before the hand-over (step 7).

## 1. Every fix names the gesture that would prove it

The fix feels finished when the tests are green. It is not resolved until
something proves it, and that something must be visible to the board: a test
[item](../guide/glossary.md#item) linked `verifies`, not a checkbox inside the fixed item's own page.

```sh
naima new tests "Export keeps the alpha channel" --set runBy=agent
naima link export-keeps verifies export-drops
```

Write the gesture so someone who was not in this session can perform it:
where to be, what to do, what must appear — and the negative half whenever
the fix has one, because a rule that always fires is the same defect the
other way round. Set `runBy` by the instrument that settles it; a person's
gesture also says `humanBecause` ([asking the human](asking-the-human.md)).

A test nobody can find is a test nobody runs: [triage](../guide/glossary.md#triage) it like any item.

When the item follows a spec (`specified-by`), confirm the code matches the
spec's current version, and say so in the test's result; `naima check` notes an
open item that still follows a superseded version. When it satisfies a
requirement, link the same test `verifies` the requirement too, and set the
requirement `met` once that test has passed — `naima check` refuses a `met`
requirement with no passing proof.

The [proof](../guide/glossary.md#proof) is the gesture as it stands, not as it once stood: `naima close`
refuses an item that a verifying item refutes (a failed test, a violated
property), and one whose verifying item `naima check` reports — a property
that holds on a model changed since its run
([closing](reporting-and-triage.md#7-closing)).

## 2. Triage what is left open

You are the last person who looked at these items. Set what you know;
`effort` especially, which nobody else can:

```sh
naima triage missing
naima triage set <item> effort=M
```

## 3. Release the claims — from the worktree

```sh
naima release <item>...
```

`release` acts on the branch you are standing on. Run from the trunk after
the merge, it would release the trunk's claims and leave the branch's behind.
It deletes your own [claim file](../guide/glossary.md#claim-file) and commits nothing: commit the deletion on the
branch, so it rides the same fast-forward as the work.

Claims outlive their work when someone forgets. Release another branch's claim
only when both hold: nothing is being worked on there, and nothing is
unlanded. Neither test alone is enough — a gone [worktree](../guide/glossary.md#worktree) can still have an
unmerged branch, and a merged branch can still have a live session working on
it. The one mechanical case is a claim naming a branch git no longer has:

```sh
naima prune            # list them
naima prune --write    # remove them, then commit the deletions
```

## 4. Write the session note

```sh
naima pass "what changed, what is proven, what is left"
```

One file of your own, on your own branch, committed with the work. A fresh
reader of only that note must know what landed, what is still unproven, and
what to pick up next. Say what was **not** verified — that sentence is worth
more than the list of what was. Never rewrite another session's note, and
never number yours.

## 5. Run the gates, and read what breaks

The project's full [gate](../guide/glossary.md#gate) set, including `naima check`; where the project
declares [metrics](../guide/metrics-and-budgets.md), `naima metrics run --record` too, and commit the
record with the work. Report each number with the one it is compared to, as the command prints it; a
bound loosened to make the work fit is refused unless an item says why (`--because`). A red result that
arrives with the trunk is not yours to absorb silently: prove where it comes
from (a detached worktree at the trunk settles it in one command), and if it
is the trunk's, open an item and say so in the [session note](../guide/glossary.md#session-note).

## 6. Merge the trunk into the branch

```sh
git merge --no-edit main
git merge-base --is-ancestor main HEAD && echo "fast-forward ready"
```

This is what makes the merge back a fast-forward. Resolve conflicts here,
where the context is. Then run step 5 again: the merge brought code you have
not tested with yours.

## 7. Hand it over

Drop the mark and commit the removal: `naima claim --not-preparing`. Then say: the merge command, that it fast-forwards, what arrives red and from
where, and what is left open with its gesture. The merge itself:

```sh
git merge --ff-only <branch>
```

If it refuses, stop ([worktree isolation](worktree-isolation.md), rule 3).

## 8. Only then, remove the worktree and the branch

```sh
naima prune --branch <who>/<what>             # what would go
naima prune --branch <who>/<what> --write     # remove the worktree, delete the branch
```

From the main checkout. It refuses a branch with commits the trunk lacks
unless an `archive/<branch>` tag holds them; `--archive` makes the tag
first, so abandoned work stays recoverable (`git switch -c <branch>
archive/<branch>`). Never `git branch -D` a branch whose work is not on the
trunk. Before a bulk sweep of the tracker (many items closed, moved or
deleted in one go), tag where it starts: `git tag checkpoint/<date>-<what>`.

## Not part of closing

- **Closing the branch's own items.** An item is closed once it is fixed
  *and* proven by a gesture, and a branch that closes its own items on the
  strength of its own green tests is marking its own homework. `naima close`
  refuses anything that is not resolved, and refuses an item the branch you
  stand on claims: close it from the trunk, after the merge, once someone
  else has checked the proof. `naima close --force` is for the one who owns
  the [evidence](../guide/glossary.md#evidence) — a proof someone else performed, recorded here.
- **Deleting the scratchpad.** It was never tracked.
