# Triage fallbacks: middle for impact/priority, worst for effort

## Behaviour

An unset `impact` or `priority` ranks as the middle of the scale (today's
2.5 constants are correct for these two). An unset `effort` ranks as the
*worst* (largest) size, not the middle 1.5 it uses today
(`src/plugins/triage/index.ts:87-89`), so that an item nobody has sized sinks
in the ranking rather than ranking ahead of every properly-sized L and XL
item — matching what the docs already promise ("an unsized item sinks") but
the code does not deliver.

## Boundaries

- This is a one-line constant change plus updated tests; it does not change
  the triage command's interface or the meaning of any triage field.
- `deno task docs` regenerates `docs/reference.md` so its description of the
  fallback values matches the corrected constants.

## Documentation

`docs/reference.md`'s triage section (regenerated) documents the corrected
fallback values; `docs/flows/reporting-and-triage.md` already documents the
intended behaviour and needs no change.

Source: REVIEW.md section 2, decision D-14; DECISIONS.md line 15.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

U4 proof run: its proving test has passed (see the test item's own Notes). Not set to shipped: the item carries no docs field naming a real page, and assigning one is a judgment call outside a tester's gesture. Left requested/planned for the filer or lead developer to pick a page and ship.
