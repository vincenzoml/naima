# v1.0.0 — first public release

## Stages

- pre-release checks
- private draft
- test the artifact
- publish
- post-release checks
- announce

Record each stage's output with `naima note <release> "Stage: <name>\n<what happened>"`.
A stage skipped on purpose: `Stage: <name> — skipped, decided by <who>`.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on main

Stage: pre-release checks
Gate first-public holds (naima gates). Clean clone of main at 37ecc0c: deno task verify exit 0 (naima check: all invariants hold), node --test exit 0, bun test 381 pass 0 fail. A first clean run at 2ca504b failed (Bun timeout on the live mCRL2 case-study test; one unformatted file); fixed in fc2df2e, then rerun green.
