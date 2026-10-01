# Per-plugin data migrations

## Behaviour

`naima.json` gains `formats: {plugin: n}`, one integer per plugin alongside
the core's own `format`. Each plugin may contribute a `migrations` array,
run by `naima update` after the core's own migration, so a plugin can rename
a field or move its own directory without forcing every unrelated plugin's
data format to bump in lockstep — which is the only option available today
(a single core-owned integer).

## Boundaries

- Must land before D-01 moves the top-level `gates` key into the new
  `plugins` table, since that move is itself a migration that needs a place
  to record the `gates` plugin's own format number.
- Per-plugin migrations follow the same rules as the core's: deterministic,
  forward-only, idempotent, and `naima check`'s `one-format` invariant is
  extended to check every plugin's format, not just the core's.

## Documentation

`docs/format.md#migrations` is extended to describe per-plugin `formats` and
the `migrations` contribution kind, alongside the existing core migration
description.

Source: REVIEW.md section 2, decision D-11 (recommendation b); DECISIONS.md
line 12.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

U4 proof run: its proving test has passed (see the test item's own Notes). Not set to shipped: the item carries no docs field naming a real page, and assigning one is a judgment call outside a tester's gesture. Left requested/planned for the filer or lead developer to pick a page and ship.
