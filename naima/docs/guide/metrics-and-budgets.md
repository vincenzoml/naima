# Metrics and budgets

A [metric](glossary.md#metric) is a name and the command that measures it:
how long the tests take, the test coverage, how many lint warnings there are,
the size of a build, how long an analysis runs. Nothing about it is specific
to software: any command that prints a number, or succeeds or fails, is one.

Naima runs the project's metrics, prints every number next to the number it
is compared to, records them per [commit](glossary.md#commit) as evidence,
holds each to a bound, and draws them as a trend.

**Example.** "The analysis must still run in under ten minutes": a metric
`analysis-time`, the command that runs the analysis, a budget of 600
seconds. A run that takes longer fails, and a release waits for it.

## Declare a metric

Metrics are data in the project's `naima-tracker/naima-data/naima.json`,
under the `metrics` plugin's options. The agent writes this once; you decide
the bounds.

```json
"plugins": {
  "metrics": {
    "options": {
      "metrics": {
        "tests": { "says": "tests that pass", "run": ["deno", "task", "test"], "kind": "number", "pattern": "(\\d+) passed", "atLeast": 197, "ratchet": true },
        "test-time": { "run": ["deno", "task", "test"], "kind": "duration", "unit": "s", "atMost": 120, "tolerance": 15 },
        "lint": { "run": ["deno", "lint"] }
      }
    }
  }
}
```

| Key | What it is |
|---|---|
| `run` | the command, as a list: the program first, then its arguments. No shell. |
| `kind` | how the number is read from the run (below). Default `exit`. |
| `pattern` | for `number`: a regular expression whose first group is the number; for `count`: the lines to count. |
| `unit`, `says` | how the number is printed, and what it measures. |
| `atMost` | a **budget**: the number may not exceed it. |
| `atLeast` | a **floor**: the number may not fall below it. |
| `equals` | a **baseline**: the number must equal it. |
| `ratchet` | a gain fails until the bound follows it: a budget only goes down, a floor only up. |
| `tolerance` | the slack around the bound, for a noisy number such as a duration. |
| `because` | the [item](glossary.md#item) that says why the bound was last loosened; written by `naima metrics bound`. |

A metric has one bound at most. With none it is recorded and holds nothing,
except kind `exit`, which must then equal 0.

### Kinds

| Kind | The number |
|---|---|
| `exit` | the command's exit code: 0 is a pass |
| `number` | the first group of `pattern` in the output; without a pattern, the first number |
| `count` | how many lines of the output match `pattern` (every non-blank line without one): warnings, findings |
| `duration` | how many seconds the command took |

A plugin can add a kind — a coverage report's format, say — through the
`metric-kinds` extension point ([reference](../reference/reference.md)).

### What the program may start

Naima runs with only the permissions it needs
([install](install.md#the-permissions)). Declaring a metric lets it start
that metric's program — the first word of `run` — and nothing more:
`naima runs` lists every program it may start, and why.

## Run them

```sh
naima metrics run              # every metric
naima metrics run tests lint   # some
naima metrics run --record     # and write the numbers as evidence
```

Every number comes with the number it is compared to: the last one recorded
on an earlier commit of this line of history, and the bound.

```
  ✓ tests: 201 (was 197, +4; floor 197) — a gain the floor 197 has not followed: raise it — naima metrics bound tests 201
  ✓ test-time: 96.2 s (was 101.5 s, -5.3; budget 120 s) — within the budget
```

It exits 1 when any metric fails: past its bound, no number read, or — a
ratchet — a gain its bound has not followed. `--record` writes one file per
run in `naima-data/metrics/`, named by the commit it measures; commit it with
the work. A run on uncommitted changes says so, in the output and in the
record.

## Move a bound

```sh
naima metrics bound tests 201                                  # tighten: a floor up
naima metrics bound test-time 140 --because bugs/slow-ci       # loosen: needs an item
```

Tightening needs nothing. Loosening — a budget up, a floor down, a baseline
moved — is refused unless `--because` names an item that says why, and the
item is written into the metric; `naima check` reports a `because` that names
no item.

## See the trend

```sh
naima metrics trend tests
```

```
tests (floor 201): ▁▂▄█  190 → 201
  3f2a…  2026-09-28  190
  9c1b…  2026-09-29  194, +4
  ...
```

The trend follows the history of the current commit: a record made on
another branch appears once that branch is merged.

## As a gate

The `metrics` [gate](glossary.md#gate) holds when the latest record of the
current commit has every metric within its bound: `naima gates metrics
--check` is the release condition "no number got worse". Run `naima metrics
run --record` first, so there is a record of the commit.
