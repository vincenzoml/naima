# Vocabulary sharing between plugins: declared `uses`, with roles as the target

## Behaviour

Immediate stopgap: every plugin that reads a field, type or relation it does
not own declares `uses: {fields, relations, types}`, validated at load time.
This surfaces today's silent hazards explicitly — for example `gates`
reading `fixedOn`, `runBy`, `verified-by` and `verifies`, all owned by
`trackers`; `trackers` hard-coding the `closed` and `bugs` types; `docs`
hard-coding `features`/`shipped` — so that a project which replaces one of
these plugins gets a load-time error instead of the silent no-op it gets
today.

Target design, once D-03 and D-04 land: roles known to the core that plugins
fill in — a "fixed" field role, an evidence relation role, an "archive" type
flag — the same pattern the existing `proves` status flag already uses
successfully. A plugin declares which role it fills; another plugin depends
on the role, never on a specific plugin's field name.

## Boundaries

- The stopgap (`uses` validation) ships first and is not wasted work: it is
  the useful degraded mode when a project has not yet adopted a plugin that
  fills a role.
- Full roles are blocked on D-03 (extension points, to declare a role as a
  point) and D-04 (traits, to say which types a role-filling field applies
  to).

## Documentation

`docs/plugin-contract.md` documents `uses` declarations and, once implemented,
the roles mechanism and the built-in roles the core ships with.

Source: REVIEW.md section 2, decision D-05 (recommendation b, with a as
stopgap); DECISIONS.md line 5.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

U4 proof run: its proving test has passed (see the test item's own Notes). Not set to shipped: the item carries no docs field naming a real page, and assigning one is a judgment call outside a tester's gesture. Left requested/planned for the filer or lead developer to pick a page and ship.
