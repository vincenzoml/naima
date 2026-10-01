# Proof currency: a registry-level predicate plus a `refutes` status flag

## Behaviour

`close` and `gates` today treat any status flagged `proves` as sufficient
proof forever, even when the property, verifier, model path or options have
since changed (REVIEW.md R-04) or when a failed test does not block the gate
under `holdsOn: "code"` (`src/plugins/gates/index.ts:53-58`).

Target: a registry-level "evidence is current" predicate that plugins
contribute (for example the verifier plugin's predicate compares
`run.property`, `run.verifier`, `run.model` and an options hash against the
item's current meta), plus a `refutes: true` status flag a plugin can put on
a status (a failed or violated test now actively blocks a gate, not merely
fails to help it).

Immediate stopgap, shipped first: `naima close` itself runs `naima check` and
refuses to close an item when a check names a problem on an item it names as
`verified-by` — closing the concrete hole (R-04, R-06) without waiting for
the general predicate mechanism.

## Boundaries

- The stopgap is a behavioural change to `close` only; it does not require
  the extension-point or trait work.
- The full predicate registry depends on D-03 (to declare "evidence
  currency" as an extension point plugins contribute to).
- `refutes` is a `StatusDef.flags` value, so it depends on D-04 landing the
  open-ended flags set.

## Documentation

`docs/flows/closing-a-worktree.md` and `docs/flows/reporting-and-triage.md`
describe what "current" evidence means and when `close` refuses; the
verifier plugin's manifest documents its currency predicate.

Source: REVIEW.md section 2, decision D-06 (recommendation c, with a as
stopgap); DECISIONS.md line 7. Repro: plugins-repro/ver.ts (cases R5, R8).

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

U4 proof run: its proving test has passed (see the test item's own Notes). Not set to shipped: the item carries no docs field naming a real page, and assigning one is a judgment call outside a tester's gesture. Left requested/planned for the filer or lead developer to pick a page and ship.
