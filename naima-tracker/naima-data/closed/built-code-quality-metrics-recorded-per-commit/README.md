# Built-in code-quality metrics recorded per commit, with history, backfill and plot

Describe it here.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/code-metrics

Naima's own metrics are not declared in naima-tracker/naima-data/naima.json: the locked program (11bb6071ebf7) has no metrics plugin, so the declaration is ready in attachments/seed-metrics.json — paste it under plugins.metrics.options.metrics once the lock moves past this branch. Proof backfill on a temp clone, last 30 first-parent commits: complexity mean 2.68 -> 3.01, complexity-max 50 -> 137 (the new jsFunctions estimator itself, code.ts), duplication 0.66 -> 1.32 %, loc 6391 -> 9999; chart in attachments/naima-code-quality.svg and .html. Tests/test-time/coverage backfilled every 10th commit only (each run 2-4 min under load): tests 207 -> 220 recorded; coverage gave no number at any commit (scripts/coverage.ts reported the tests failed under the loaded machine) — a gap, not a zero.

### 2026-10-01 — Vincenzo Ciancia, on claude/metrics-data

Declared the metrics from attachments/seed-metrics.json under plugins.metrics.options.metrics in naima-tracker/naima-data/naima.json (the working-tree program accepted it: `deno task dev check` holds; the locked program at 625aa989f8a7 still lacks the metrics plugin, so `deno task naima check` was not tried — move the lock after merging). Records now live as plain data in naima-tracker/naima-data/metrics/: 31 files, one per commit, covering `git log --first-parent -30` plus HEAD (71af35b7f549). `naima metrics history --csv` reads all 31 back. Chart regenerated from these records and replaces the earlier attachment: attachments/naima-code-quality.svg and .html (last 30 commits).

Corrected the coverage caveat: it is not "tests failed under the loaded machine". `deno task coverage` on HEAD, run twice outside any backfill, panics inside Deno 2.9.7 itself — `thread 'main' panicked at cli/tools/coverage/mod.rs:152:6: a UTF-16 offset within the source has a byte offset` — while collecting coverage for test/, which scripts/coverage.ts (naively) reports as "the tests failed; no coverage report". Deterministic, not load-related, and not ours to fix: an upstream Deno bug. Left as a genuine gap (0 of 31 commits have a coverage number) until Deno fixes it or scripts/coverage.ts works around it.
