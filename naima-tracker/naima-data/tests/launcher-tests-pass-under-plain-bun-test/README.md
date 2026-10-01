# The launcher tests pass under plain bun test while three Node suites load the machine (test/launcher.test.ts)

## Gesture

Start three `node --test "test/**/*.test.ts"` runs in the background, wait 20 s, then run `bun test test/launcher.test.ts` twice; stop the Node runs.

Pass: 6 pass, 0 fail, both times.

## Result

2026-10-01, final sweep (claude/final-sweep). Red, before the fix: 4 fail and 3 fail, each stopped at about 5.1 to 5.6 s (Bun's default timeout: the allow-listed environment, init --write-excludes, init --write-agent-pointer, ui on loopback). Fix: those four tests carry `timeout: LAUNCHED` (30 s), as 9968ca0 did for the init and distribution tests. Green, same load: 6 pass, 0 fail, both times.
