# Code-quality metrics: suites red then green on Deno, Node and Bun; Naima's own 30-commit backfill plotted

Proves the built-in code-quality metrics feature by gesture.

## Gesture 1: the suites, red then green

```sh
deno test -A test/plugins/metrics/        # then node --test and bun test on the same files
```

`test/plugins/metrics/code.test.ts` pins: the TypeScript/JavaScript estimator (functions, arrows, methods, decisions; strings, comments, regular expressions and type annotations ignored); comment stripping; duplication, statistics, manifests, path selection; presets and their refusals; `metrics run --record` of code measures with the commit date; `metrics history` in text, JSON and CSV; `metrics backfill --last --every` measuring past commits with the working tree, its uncommitted change and the worktree list unchanged, and skipping what is recorded; `metrics plot` SVG and `--html --out`; the metrics section in `naima summary`, at the foot of `naima board` and `naima queue`; the metrics gate's reasons; `metrics presets`.

Red: written before the implementation, 5 of 8 failed. Green: 15 of 15 in the metrics directory on Deno, Node and Bun; then the whole suite and `deno task verify`.

## Gesture 2: Naima's own timeline

On a temporary clone of this branch, with the metrics of `seed-metrics.json` (attached to the feature) declared, `naima metrics backfill` over the last 30 commits, then `naima metrics plot` of complexity, duplication, loc and coverage: the chart is attached to the feature as `naima-code-quality.svg` and `naima-code-quality.html`.

Must appear: one panel per metric, a point per commit measured, a dashed line where a bound is declared. Negative half: the working tree of the clone is unchanged by the backfill (`git status` shows only the new records), and no temporary worktree is left (`git worktree list` has one entry).

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/code-metrics

Ran this session: red 5 of 8 failed before the implementation; green deno task verify 256 passed 0 failed, node --test 256 pass 0 fail, bun test 256 pass 0 fail. Backfill on a temp clone: git status showed only naima.json (the declaration) and the new metrics/ records; git worktree list had one entry. Not verified: the backfill and plot under the launcher's narrowed permissions (run with -A); deno.coverage and node.* presets measured only by their own patterns, not on a real project here.
