# A real naima verify run of the mCRL2 verifier, under the launcher's fence, reaches the mCRL2 tools and returns a verdict other than error

With the mCRL2 toolset on PATH and the pinned runtime holding the fix, run `naima verify` on the two coordination-model properties through the launcher (`deno task naima`, not `-A`): each run record's verdict is holds or violated, never error with a write-access refusal. Runs once the fix is on the trunk and the lock is moved to it with `naima update`.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/mcrl2-coordination-check

Red on 2026-10-01: two naima verify runs on the runtime before the fix (lock ae595381fbd1) recorded verdict error, a write-access refusal on the system temporary directory (run records of 20:17 and 20:28 on both properties). Green on 2026-10-01: with the lock moved to 2c3a166a61cb, which holds the fix, the same command recorded holds on both properties.
