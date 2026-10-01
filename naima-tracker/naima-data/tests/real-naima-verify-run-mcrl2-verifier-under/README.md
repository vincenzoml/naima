# A real naima verify run of the mCRL2 verifier, under the launcher's fence, reaches the mCRL2 tools and returns a verdict other than error

With the mCRL2 toolset on PATH and the pinned runtime holding the fix, run `naima verify` on the two coordination-model properties through the launcher (`deno task naima`, not `-A`): each run record's verdict is holds or violated, never error with a write-access refusal. Runs once the fix is on the trunk and the lock is moved to it with `naima update`.
