# Slug uniqueness: check unmerged local refs at creation, uuid fallback

## Behaviour

`naima new` checks the candidate slug against every unmerged local ref
(reusing the cross-branch reader from D-08) before writing, so two branches
opening an item with the same title no longer both write
`bugs/<slug>/meta.json` and produce an add/add merge conflict that
contradicts the worktree-isolation promise (REVIEW.md core #6, repro
`core-repro/r4.sh`).

Fallback: when refs cannot be read (for example, no git repository, or a
shallow clone that cannot enumerate other branches), a short uuid-prefix
suffix is appended to the slug instead, so item creation never blocks on an
unreadable ref set.

## Boundaries

- This is a creation-time check only; it does not retroactively rename
  existing on-disk slugs.
- Documentation states plainly that this reduces, but does not eliminate,
  slug collisions (a slug check against local refs cannot see a not-yet-fetched
  remote branch's new item).

## Documentation

`docs/flows/worktree-isolation.md` documents the check and its fallback.

Source: REVIEW.md section 2, decision D-09 (recommendation b, with a as
fallback); DECISIONS.md line 10. Repro: core-repro/r4.sh.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

U4 proof run: its proving test has passed (see the test item's own Notes). Not set to shipped: the item carries no docs field naming a real page, and assigning one is a judgment call outside a tester's gesture. Left requested/planned for the filer or lead developer to pick a page and ship.
