# Piping naima's output into a reader that closes early ends quietly, on Deno, Node and Bun (test/core/epipe.test.ts)

The gesture that proves it, step by step, and what a pass looks like.

## Result

What was seen, when, and by whom.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u8-papercuts

Result: pass. Gesture: test/core/epipe.test.ts spawns naima list under deno, node and bun, closes the reader after the first line, asserts exit 0 and empty stderr. Red on the old code (node, bun: EPIPE/ENOTCONN stack trace, exit 1); green on all three after the fix in naima/src/core/context.ts. Run as part of the full suite: deno task verify (typecheck/lint/fmt/test/check/docs all pass), node --test "test/**/*.test.ts" (241 passed, 0 failed), bun test ./test/ (241 passed, 0 failed, three repeats and one concurrent-load repeat, no --timeout).
