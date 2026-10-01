# Deferrals: reopensWhen, view parked, the deferred-says-why check, and authoritative documents (test/plugins/triage/deferral.test.ts, on Deno, Node and Bun)

The gesture that proves it, step by step, and what a pass looks like.

## Result

What was seen, when, and by whom.

## Notes

### 2026-10-01 — U13 deferrals, on claude/u13-deferrals

Passed on claude/u13-deferrals at 902fb93c17bd1a31fa31146fcaae5351a3ff4984. Scoped: deno test -A test/plugins/triage/ 18/18; node --test test/plugins/triage/**/*.test.ts 18/18; bun test ./test/plugins/triage/ 18/18. Full suite: deno task verify green except one note on a sibling worktree (claude/d2-people-docs, not mine to fix); node --test full suite 255/255; bun test ./test/ flaked three times under heavy concurrent load on this shared machine (git-subprocess timeouts in test/init.test.ts, test/distribution.test.ts, unrelated to this change — several other agents' deno task verify were running in parallel). Red seen first: the view, field, checks and guide section did not exist; the scoped tests failed with 'no view parked' / missing field before the code was written.
