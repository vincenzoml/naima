# Views return `{data, text()}`; checks, gates and views may be async

## Behaviour

Every view and summary section returns `{data, text()}` instead of a plain
string, so a renderer can format the same data as text, JSON or markdown
without re-deriving it. Checks, gates and views are allowed to return a
promise, so a plugin can, for example, shell out to an external tool as part
of a check without the core needing a special case.

## Boundaries

- Ships in the same plugin-contract version bump as D-10 (external plugins),
  since both change what a plugin factory's return shape is allowed to look
  like.
- Existing plugins returning plain strings/sync values keep working through
  a compatibility shim, until the contract version bump is adopted.

## Documentation

`docs/plugin-contract.md` documents the `{data, text()}` view return shape
and the allowed-async list (checks, gates, views), alongside the CONTRACT
version bump introduced by D-10.

Source: REVIEW.md section 2, decision D-13; DECISIONS.md line 14.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

U4 proof run: its proving test has passed (see the test item's own Notes). Not set to shipped: the item carries no docs field naming a real page, and assigning one is a judgment call outside a tester's gesture. Left requested/planned for the filer or lead developer to pick a page and ship.
