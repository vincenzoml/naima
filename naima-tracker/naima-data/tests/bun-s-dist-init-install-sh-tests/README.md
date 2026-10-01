# Bun's dist, init and install.sh tests carry an explicit timeout and do not time out under load (test/dist.test.ts, test/init.test.ts, test/site.test.ts)

The gesture that proves it, step by step, and what a pass looks like.

## Result

What was seen, when, and by whom.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u8-papercuts

Result: pass. Gesture: bun test ./test/ (no --timeout) run three times, then twice concurrently, all green (241 passed, 0 failed each run) — the repro condition from the bug report (another run going at the same time). Fix: bunfig.toml ([test] timeout = 30000) plus explicit { timeout: 30_000 } on the three named-slow test() calls in test/dist.test.ts, test/init.test.ts and test/site.test.ts. Logs: bun-final.log, bun-conc-a.log, bun-conc-b.log in the session scratchpad.
