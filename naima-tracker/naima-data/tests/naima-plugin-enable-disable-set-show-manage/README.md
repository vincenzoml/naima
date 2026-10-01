# naima plugin enable|disable|set|show manage the plugins table

The gesture that proves it, step by step, and what a pass looks like.

## Result

What was seen, when, and by whom.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/plugin-command

deno task verify (typecheck, lint, fmt, unit tests, docs-current, naima check): all invariants hold. node --test "test/**/*.test.ts": 379 tests, 377 pass, 2 skipped, 0 fail. bun test ./test/: 379 tests, 377 pass, 2 skip, 0 fail. New assertions in test/configuration.test.ts cover naima plugin show/enable/disable/set, including the opt-in verifier-mcrl2 case (enable, set bin=, unset, disable), an unknown-option refusal, a non-opt-in plugin pruning back to the default on enable, and core/unknown-name refusals.
