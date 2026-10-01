# A property set to holds by hand in meta.json, with no run, fails naima check (test/plugins/verifier/verifier.test.ts)

The gesture that proves it, step by step, and what a pass looks like.

## Result

What was seen, when, and by whom.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u10-proof-integrity

Result: pass. Gesture: the verifier test writes status holds into a property's meta.json with no run, reloads and runs the checks: property-evidence reports 'holds, but carries no run'. This counterpart of the holds-only-by-verify hook already existed; the test pins it, so it was green from the start, not red-then-green. Deno, Node and Bun.
