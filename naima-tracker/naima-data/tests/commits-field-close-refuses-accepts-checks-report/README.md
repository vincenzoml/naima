# commits field: close refuses/accepts, checks report bad or missing commits

The gesture that proves it, step by step, and what a pass looks like.

## Result

What was seen, when, and by whom.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u9-commits

test/plugins/trackers/commits.test.ts (5 tests, red then green), plus lifecycle.test.ts and trackers.test.ts updated. Implementation: bugs/todos/features/closed carry commits (strings); naima close refuses without a commit reachable from the trunk unless --force; checks commits-are-real and closed-names-its-commits (grandfathered by plugins.trackers.options.commitsRequiredFrom, default 2026-10-01). Gates on commit 727e41d: deno task verify 0 exit, all invariants hold; node --test 240/240; bun test 237/240 (3 unrelated init.test.ts timeouts under host load ~26, confirmed infra flake). Commits: 48c56fa (feature), 727e41d (stale-anchor fix docs-pages.test.ts caught).
