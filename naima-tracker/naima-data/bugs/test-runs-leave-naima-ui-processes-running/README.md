# Test runs leave naima ui processes running and the suites hang

Running the test suites leaves 'naima ui --no-open' processes (a deno server and its sandboxed child) alive from a temporary launcher project, and a node --test runner keeps waiting on them: a worker's gates were seen running for over an hour, with processes 81 minutes old. Expected: every test that starts ui stops it on every path, and a suite that hangs fails within a bounded time.

## Notes

### 2026-10-01 — implementer agent, on claude/ui-test-hang

Cause: test/launcher.test.ts started ui --no-open detached and sent SIGINT to its group only after every assertion passed; a failed assertion, or an address never printed, skipped the kill, finally removed only the temp directory, and the live children's pipes kept the test file's process alive, so the runner waited forever. ui --no-open waiting for Ctrl-C is by design and is unchanged; no exit hook was needed. Fixed by test/core/processes.ts (own process group, 60 s bounded waits, stop() SIGTERM then SIGKILL in finally) and a 120 s per-test timeout.

### 2026-10-01 — triage agent, on claude/effort-triage

Read the item's own note and commit bd1715e (test/core/processes.ts, test/launcher.test.ts): a contained process-lifecycle fix, already shipped in one commit.
