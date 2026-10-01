---
date: 2026-10-01
at: 2026-10-01T13:56:49.535Z
branch: claude/evidence-close-3
---

Evidence review: closed 9 resolved items (8 features + 1 todo) whose red-then-green gesture tests held real proof, backfilling commits fields where the schema had caught up since landing; added a new proving test for remove-historical-narrative-from-docs-user-facing which had fixedOn but no link. Left 2 features not-closing as already correctly flagged in evidence-close-2 (Windows install, owner-usability gesture still open/human). Reopened jargon-audit-docs-site-skill-plain-english: attached logs proved only that tests pass, not the jargon/glossary/paper-reference claim itself. Of the 9 open tests items, only one was agent-performable and CI-shaped (ci-runs-pinned-linux-macos-pushes-dist); withdrew it and macos-ci-jobs-deno-node-bun-macos as obsolete (ci.yml and the dist branch no longer exist), and dropped todos/ci-not-reproducible-runs-ubuntu-only for the same reason, pointing at todos/re-enable-test-suites-ci. The other 7 open tests are runBy=human or runBy=build, out of agent reach, left untouched. deno task verify: 349 passed, 0 failed, 1 ignored (mCRL2 live, tool not installed). node --test and bun test: 349 pass, 0 fail, 1 skip each. All green on commit 20c0973.
