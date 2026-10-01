# CI runs pinned on Linux and macOS and pushes the dist from main

## Gesture

1. Read `.github/workflows/ci.yml`: every `uses:` names a 40-hex commit (the
   tag in a comment), Deno, Node and Bun versions are exact, every job has
   `timeout-minutes`, the workflow has `concurrency`, `permissions` is
   `contents: read` at the top and `contents: write` only on the `dist` job.
2. Push a commit to main: the `deno`, `node` and `bun` jobs are green on
   `ubuntu-24.04` and `macos-15`; the `dist` job runs after them and pushes
   `dist`, whose head carries `Source-Commit: <that main commit>`.
3. Push a commit that changes only `naima-tracker/`: the dist job reports
   `unchanged` and `dist` does not move.
4. Negative half: on a pull request, or a push to another branch, the dist
   job does not run.

Pass: all hold.

## Result

Step 1 performed by the author on 2026-09-30 (read): pass. Steps 2–4 not
performed: the workflow has not run; nothing is pushed.

## Notes

### 2026-10-01 — Claude, on claude/evidence-close-2

Evidence-close-2: not run. .github/workflows/ now holds only pages.yml — no ci.yml exists to inspect or push to, and the dist branch this test checks for is being replaced by copy-on-install (features/copy-install-program-plain-copy-naima-from). The gesture as written no longer applies; left open for whoever updates or retires it alongside the dist removal.
