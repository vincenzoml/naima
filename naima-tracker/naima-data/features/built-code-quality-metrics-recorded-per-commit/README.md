# Built-in code-quality metrics recorded per commit, with history, backfill and plot

Describe it here.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/code-metrics

Naima's own metrics are not declared in naima-tracker/naima-data/naima.json: the locked program (11bb6071ebf7) has no metrics plugin, so the declaration is ready in attachments/seed-metrics.json — paste it under plugins.metrics.options.metrics once the lock moves past this branch. Proof backfill on a temp clone, last 30 first-parent commits: complexity mean 2.68 -> 3.01, complexity-max 50 -> 137 (the new jsFunctions estimator itself, code.ts), duplication 0.66 -> 1.32 %, loc 6391 -> 9999; chart in attachments/naima-code-quality.svg and .html. Tests/test-time/coverage backfilled every 10th commit only (each run 2-4 min under load): tests 207 -> 220 recorded; coverage gave no number at any commit (scripts/coverage.ts reported the tests failed under the loaded machine) — a gap, not a zero.
