# A change to a file a property's model includes, or to the tool version, makes its verdict stale (test/plugins/verifier/verifier.test.ts)

The gesture that proves it, step by step, and what a pass looks like.

## Result

What was seen, when, and by whom.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u10-proof-integrity

Result: pass. Gesture: two verifier tests. A model includes parts/part.txt (#include in the example adapter); naima verify records both inputs, the tool version and one digest; editing the included file makes property-evidence report the property stale, and verify again gives violated. A stand-in adapter's version moves from 1.0 to 2.0: the check reports the run stale until verify runs again. Red before the change (verify returned 1, no toolVersion recorded), green after. Deno, Node and Bun.
