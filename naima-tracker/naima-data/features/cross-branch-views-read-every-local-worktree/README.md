# Cross-branch views read every local worktree's disk, local branches only

## Behaviour

`readAcrossBranches` (`src/core/git.ts:136-146`) reads the *other*
worktrees' current path from `git worktree list --porcelain`, not only their
committed refs, so that uncommitted claims on a currently-checked-out branch
are visible to every other worktree, including the trunk. Two workers'
uncommitted claims on the same item, invisible to each other today
(REVIEW.md R-08/D-08, repro `plugins-repro/coord.ts` case R1), become
visible.

Scope: local branches only. `refs/remotes` is explicitly out of scope for
this feature.

## Boundaries

- Docs are corrected to say precisely "every local branch, reading each
  worktree's disk when one is checked out, otherwise its ref" — replacing
  today's inaccurate "whatever each worktree is standing on, uncommitted
  files included" (which today only ever means the worktree the command runs
  in).
- A branch with no worktree checked out still falls back to reading its
  committed ref, unchanged from today.

## Documentation

`docs/flows/worktree-isolation.md` and `docs/concepts.md` are corrected to
describe exactly this behaviour.

Source: REVIEW.md section 2, decision D-08 (recommendation a); DECISIONS.md
line 9. Repro: plugins-repro/coord.ts (case R1).

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

U4 proof run: its proving test has passed (see the test item's own Notes). Not set to shipped: the item carries no docs field naming a real page, and assigning one is a judgment call outside a tester's gesture. Left requested/planned for the filer or lead developer to pick a page and ship.
