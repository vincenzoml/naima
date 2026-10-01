# Code-quality metrics over time

When the owner asks how the code's quality moves — "plot coverage and
complexity over the last 50 commits", "is the code getting more complex?",
"show me the lint warnings since the release" — the answer is the project's
[metrics](../guide/glossary.md#metric), recorded per commit in
`naima-tracker/naima-data/metrics/` and read back along the commit timeline.
The person's side is [metrics and budgets](../guide/metrics-and-budgets.md);
this page is what you do.

## 1. Make sure the metrics are declared

```sh
naima metrics            # what is declared, and the last number of each
naima metrics presets    # the ready ones: code.*, deno.*, node.*
```

A metric the owner names that is not declared is declared from a preset,
under `plugins.metrics.options.metrics` in `naima-tracker/naima-data/naima.json`:
`"coverage": { "preset": "deno.coverage" }`. Fit the preset to the
project — its own test command in `run`, the source directories in
`include` — and say what you assumed. A bound is the owner's decision: declare
the metric without one unless they gave it.

## 2. Fill the timeline

```sh
naima metrics backfill coverage complexity --last 50
```

It measures each commit of the first-parent line that has no record of those
metrics yet, and writes one record file per commit. Code measures (`code.*`)
read the commit from git's objects and take well under a second each; a
metric that runs a command (tests, coverage) runs it in a temporary worktree
for every commit, so fifty commits of a slow test suite take fifty test runs:
use `--every 5` and say so. The working tree is never touched. A commit whose
command fails is recorded with no number and is a gap in the chart, not a
zero.

Commit the records on your branch, like any evidence
([closing a worktree](closing-a-worktree.md#5-run-the-gates-and-read-what-breaks)).

## 3. Draw it, and show it

```sh
naima metrics plot coverage complexity --last 50 --out quality.svg
naima metrics plot coverage complexity --last 50 --html --out quality.html
naima metrics history coverage complexity --last 50 --csv
```

The SVG has one panel per metric — commit dates on x, the value on y, the
bound as a dashed line — and needs nothing to render. The HTML page adds a
table: the first and last value of each, and whether the change is better or
worse by the metric's `better`. Show the owner the chart, not the commands;
for numbers they want to work with themselves, the CSV.

When the owner wants to look at the metrics themselves rather than at a
file, tell them `naima ui`: a native window with every metric, a picker and
a commit range, read live from the records. It holds the terminal until the
window closes, so you do not run it on their behalf in a session that must
go on; for a check of your own, `naima ui --no-open --log` prints the address
with its token and one line per request, and `/data/metrics?metric=…&from=…&to=…`
answers the same view as JSON. Where the window cannot open it falls back to
the browser and says why in one line: report that line, it is the diagnosis.

A plugin adds a tab to that window by contributing a view to the `ui-views`
extension point — `name`, `title`, `says`, `render(params, ctx) → { data,
html, css? }` — rendered at each request
([the reference](../reference/reference.md)); the ui plugin never names the
plugins it shows.

Under the launcher Naima may write only inside the tracker directory: when
`--out` is refused, print the chart and redirect it,
`naima metrics plot coverage > quality.svg`.

## 4. Read it before you report it

Say what the chart shows in one line, with the numbers it is drawn from
(`naima metrics history` prints them): "coverage 78 % → 84 % over 50 commits;
complexity flat at 3.0, the worst function went from 41 to 52". The
complexity numbers are an estimate — a token scan of TypeScript and
JavaScript, not a parser — so report a trend, not a single function's score
as a fact.
