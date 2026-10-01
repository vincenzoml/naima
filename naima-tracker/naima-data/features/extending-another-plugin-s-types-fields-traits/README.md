# Extending another plugin's types and fields: traits plus additive `extends`

## Behaviour

Two independent mechanisms, used together:

- **Traits.** A type declares `traits: ["fixable"]` (a plain string tag, no
  inheritance); a field applies to types by tag instead of listing every type
  by name. This replaces cases like `fixedOn`'s hard-coded
  `appliesTo: ["bugs","todos","closed"]` (`src/plugins/trackers/index.ts:220`),
  where today a second declaration for the same field is a fatal load error.
- **Additive `extends`.** A project or plugin can add a new status to an
  existing type (for example a `blocked` status on `bugs`), or add an enum
  value to an existing field, through an `extends` contribution. Redefining
  an existing status is allowed only when its category (open/done) matches
  the one already declared — it can never flip a status's meaning.
- `StatusDef` gains an open-ended `flags` set next to the built-in open/done
  category (so a plugin can mark a status, for example, `refutes: true` —
  used by D-06), plus an optional transitions map constraining which statuses
  a status may move to.
- The `gate` field takes its enum values from `registry.gates` (populated at
  load time), and an item may carry more than one gate.

## Boundaries

- Data-only: no inheritance hierarchy anywhere in this design, matching the
  owner's explicit preference. A field either declares traits it applies to,
  or an exact list of types; both continue to work.
- `extends` cannot redefine a field's kind or a status's open/done category —
  only add.
- Depends on D-03 (traits and `extends` are themselves extension-point
  concepts) and feeds D-05 (vocabulary sharing needs traits to express "any
  type this role applies to").

## Documentation

`docs/plugin-contract.md` documents `traits`, `extends` and `StatusDef.flags`
with the redefinition rule; `docs/reference.md` shows each type's traits and
each field's applicability.

Source: REVIEW.md section 2, decision D-04 (recommendation c, both traits and
extends); DECISIONS.md line 4.
