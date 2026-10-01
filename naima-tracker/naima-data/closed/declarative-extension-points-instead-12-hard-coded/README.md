# Declarative extension points instead of 12 hard-coded kinds

## Behaviour

A plugin may declare a new `ExtensionPoint<T>` (an id, a `says` description,
a storage key, a `validate` function and its own documentation), the way the
verifier plugin needed a new core concept and today can only get one by
editing `src/core/types.ts:164-184` and `src/core/registry.ts` by hand.
Plugins contribute to any declared point via `contributes: {pointId: [...]}`.

The 12 kinds fixed in core today (types, statuses, fields, relations,
checks, views, gates, verifiers, commands, summary sections, rank terms,
migrations) become built-in extension points, defined the same way a
third-party point would be. The existing typed fields on `PluginDef` remain
as convenience sugar over the same mechanism, so existing plugins do not have
to be rewritten.

## Boundaries

- The fixed on-disk layout (`naima-data/<type>/<slug>/{README.md,meta.json,attachments/}`)
  stays the compatibility boundary between forks — a pluggable storage layer
  (ext L21) is explicitly out of scope, per the recommendation.
- `naima plugins` and the docs plugin, which list the 12 kinds by hand today,
  are rewritten to enumerate the registered extension points instead.
- This is what makes "the core does not move" true in practice: after this
  feature, adding a new kind of contribution to a project no longer requires
  editing `src/core/`.

## Documentation

`docs/plugin-contract.md` gains the `ExtensionPoint` shape and an example of
declaring a new point from a plugin; `docs/reference.md` lists registered
extension points and their contributors.

Source: REVIEW.md section 2, decision D-03 (recommendation b); DECISIONS.md
line 3.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

U4 proof run: its proving test has passed (see the test item's own Notes). Not set to shipped: the item carries no docs field naming a real page, and assigning one is a judgment call outside a tester's gesture. Left requested/planned for the filer or lead developer to pick a page and ship.
