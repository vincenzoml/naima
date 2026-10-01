# Names: qualified plugin/name ids with short aliases and a rename map

## Behaviour

Every contribution any plugin declares (field, type, relation, check,
summary section, rank term, gate, verifier, command) gets a qualified id
`plugin/name`. Stored data (meta.json, naima.json) keeps the short, unqualified
name for readability. When two plugins' contributions collide on-disk, the
project resolves it with a `rename` map in `naima.json` rather than the fatal
load error that happens today.

Short aliases work automatically as long as they stay unambiguous project-wide;
they stop resolving, with a clear error naming both qualified ids, the moment
a second plugin declares the same short name.

## Boundaries

- Collision checking is extended to checks, summary sections and rank terms,
  none of which are checked for collisions today (REVIEW.md R-21 covers the
  command/check part of this as an immediate defect fix, independent of this
  feature).
- This is a format and plugin-contract change: existing single-plugin
  projects are unaffected (their contributions have no collision to resolve),
  but the qualified-id scheme must exist before a third-party plugin
  ecosystem is documented as supported.
- Decided now, before any third-party ecosystem exists, precisely so the
  scheme does not have to migrate live data later.

## Documentation

`docs/plugin-contract.md` specifies the qualified-id format and the
`rename` map; `docs/reference.md` is regenerated to show qualified ids
alongside short aliases for every contribution.

Source: REVIEW.md section 2, decision D-02 (recommendation b); DECISIONS.md
line 2.
