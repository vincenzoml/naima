# Prove and close

A fix is a claim. An item is closed only once something proves it
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
the output, a screenshot, a number — then set the result:

```sh
naima set export-keeps status=passed      # or failed, or partial
```

| Status | Means |
|---|---|
| `passed` | it holds; the page carries the measurement — this [proves](glossary.md#proves) |
| `failed` | it does not hold — this [refutes](glossary.md#refutes), and blocks closing |
| `partial` | performed in part; the page lists what is left as `- [ ]` lines |

## 4. Close it

```sh
naima close export-drops
```

It moves to `closed/`, carrying its proof. Naima refuses when:

- it is not fixed, or nothing that verifies it has passed;
- something that verifies it refutes it — a failed test;
- its proof is no longer current (a property whose model changed since its
  run: run `naima verify` again);
- the branch you stand on [claims](glossary.md#claim) it. Close it from the
  trunk, after the merge, once someone other than the fixer has checked the
  proof ([the rule](rules.md#whoever-fixes-does-not-also-close)).

`naima close --force` overrides the last one, for the person who owns the
evidence — a proof someone else performed, recorded here.

## Properties, proven by a tool

A [property](glossary.md#property) is proven by a [verifier](glossary.md#verifier)
— a model checker — instead of by hand. `naima verifiers` lists the ones
available; `naima verify <property>` runs it and attaches the run. A property
becomes `holds` only that way, never with `naima set`.
