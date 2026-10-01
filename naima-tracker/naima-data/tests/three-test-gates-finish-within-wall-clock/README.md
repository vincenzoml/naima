# The three test gates finish within a wall-clock limit and leave no naima ui process behind

Run deno task verify, node --test "test/**/*.test.ts" and bun test --timeout 30000 ./test/, each under a 900-second wall-clock limit (perl -e 'alarm 900; exec @ARGV'). Passes when each exits 0 before the limit and ps then lists no process from a naima-launcher-* temporary project. The unit guards are test/core/processes.test.ts (a wait that never answers fails in bounded time; stop() leaves nothing of the group) and the failure-path test in test/launcher.test.ts (a ui whose test throws while it serves is still stopped, launcher and program).

## Notes

### 2026-10-01 — implementer agent, on claude/ui-test-hang

Run on bd1715e under a 900 s alarm each, in parallel: deno task verify exit 0 (deno test 366 passed, 0 failed, 2m59s; check: all invariants hold); node --test exit 0 (366 pass, 0 fail, 64 s); bun test --timeout 30000 exit 0 (366 pass, 1 skip, 0 fail, 180 s). ps afterwards: 0 processes from a naima-launcher-* project or the guard's marker. Before the fix the launcher ui test passed alone in 3.7 s; the hang needs a failing step, which the new failure-path test now exercises.
