# Prove and close

A fix is a claim. An [item](glossary.md#item) is closed only once something proves it
([three states](rules.md#fixed-resolved-and-closed-are-three-states)). The
whole path, run for real, is in [the tutorial](tutorial.md#6-fix-it).

## 1. Mark it fixed

When the code exists:

```sh
naima set export-drops fixedOn=2026-10-01
```

The item is now [fixed](glossary.md#fixed), and `naima check` notes that
nothing verifies it yet.

## 2. Write the gesture as a test item

```sh
naima new tests "Export keeps the alpha channel" --set runBy=agent
naima link export-keeps verifies export-drops
```

On the test's page, write the [gesture](glossary.md#gesture) so someone who
was not there can perform it: where to be, what to do, what must appear — and
what must **not** appear, when the fix has that half.

Set [`runBy`](glossary.md#run-by) by what would settle it:

| If it is settled by… | `runBy` |
|---|---|
| a command: a unit test, a script, a search | `agent` |
| driving the running software: clicking, a screenshot | `agent-hands` |
| only a person: how it looks or feels, a decision, a credential, a physical act | `human`, and `humanBecause` (`judgement`, `decision`, `credential`, `physical`) |
| an artefact nobody here can make: a signed build, a second machine | `build` |

```sh
naima new tests "Export looks right on a phone" --set runBy=human --set humanBecause=judgement
```

`naima check` fails on `runBy=human` without `humanBecause`
([the rule](rules.md#work-handed-to-a-person-says-why)).

## 3. Perform it, keep the evidence

Do what the page says. Put what you saw in the test's `attachments/` folder —
the output, a screenshot, a number — with `naima attach`, which records that
the file is yours (`--own`), then set the result:

```sh
naima attach export-keeps run.txt --own
naima set export-keeps status=passed      # or failed, or partial
```

| Status | Means |
|---|---|
| `passed` | it holds; the page carries the measurement — this [proves](glossary.md#proves) |
| `failed` | it does not hold — this [refutes](glossary.md#refutes), and blocks closing |
| `partial` | performed in part; the page lists what is left as `- [ ]` lines |

Say what kind of evidence you kept, from the ranking, strongest first:

| Rank | `evidenceKind` | The evidence |
|---|---|---|
| 1 | `owner-gesture` | the owner performed the gesture and saw the result |
| 2 | `observation` | a screenshot, a log line or a number, kept with the item |
| 3 | `live-read` | the live state, read by tooling: a query, an API call, the running program's own answer |
| 4 | `diff` | a before-and-after comparison: counts, sizes, outputs |
| 5 | `inspection` | "the code looks right" — which proves nothing |

```sh
naima set export-keeps evidenceKind=observation
```

A number is evidence only beside its comparison: before and after, expected
and seen. "The code looks right" is not evidence at all: `naima check` notes a
passed test whose `evidenceKind` is `inspection`.

**Red, then green.** A test that verifies a bug is a regression test. Run it on
the code before the fix and see it fail; then on the fix, and see it pass. Write
down the day it failed, and keep the failing run with the passing one:

```sh
naima set export-keeps redSeen=2026-01-13
```

`naima check` notes a passed regression test with no `redSeen`
(`regression-test-saw-red`).

Keep the pages current. `naima check` notes an open item whose unticked
`- [ ]` clause names a test — as `tests/<slug>`, or as "the linked test" — that
has passed (`unticked-clause-names-passed-test`): tick the clause, or reopen
the test. It also notes an open test marked `runBy: agent` whose page says it
could not run because something was held (`test-excuses-itself`): an agent's
gesture waits on no one, so run it now, or say who must. The phrases it looks
for are the option `excusePhrases` of the `trackers` plugin; any of these notes
can be raised to a problem, or switched off, under `plugins.trackers.checks` in
`naima.json`.

## 4. Name the commit

```sh
naima set export-drops commits=3f2c1a9
```

`commits` is a list of git commit hashes — the code that fixed it, from the
trunk. A hash never named here was never retrofitted by guessing: if the fix
predates this field, the item is grandfathered (below), not patched with a
guess.

## 5. Close it

```sh
naima close export-drops
```

It moves to `closed/`, carrying its [proof](glossary.md#proof). Naima refuses when:

- it is not fixed, or nothing that verifies it has passed;
- something that verifies it refutes it — a failed test;
- its proof is no longer current (a property whose model, an included file
  or the tool's version changed since its run: run `naima verify` again);
- none of its `commits` is a real commit reachable from the trunk;
- the branch you stand on [claims](glossary.md#claim-file) it. Close it from the
  [trunk](glossary.md#trunk), after the merge, once someone other than the fixer has checked the
  proof ([the rule](rules.md#whoever-fixes-does-not-also-close)).

`naima close --force` overrides the last two, for the person who owns the
[evidence](glossary.md#evidence) — a proof someone else performed, recorded here.

An item closed before `commits` existed is not checked for one: the rule
applies from a date (`plugins.trackers.options.commitsRequiredFrom` in
`naima-tracker/naima-data/naima.json`, default 2026-10-01). An item closed the
same day the rule shipped is grandfathered by a one-time migration instead,
`commits=legacy` — never a guessed hash, and never enough to satisfy
`naima close` itself. `naima check` reports a closed item from on or after
that date with no commit and no `legacy` marker, and any item whose `commits`
names a hash git does not have.

## Properties, proven by a tool

A [property](glossary.md#property) is proven by a [verifier](glossary.md#verifier)
— a model checker — instead of by hand. `naima verifiers` lists the ones
available; `naima verify <property>` runs it and attaches the run. A property
becomes `holds` only that way, never with `naima set`.

The run records every file the tool read — the model and each file it
includes, as the adapter declares them — with one digest over all of them
and the tool's version. When any of them changes, or the model comes to
read other files, `naima check` reports the property no longer current:
run `naima verify` again. The example adapter reads `#include <path>` lines,
so a model split across files shows it.
