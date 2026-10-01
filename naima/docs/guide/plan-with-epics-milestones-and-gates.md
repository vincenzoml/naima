# Plan with epics, milestones and gates

Three ways to say what a body of work is for and when it is done, each one command away. Nothing here needs editing `naima.json` by hand.

| Word          | What it is                                                            | Made with                                       |
| ------------- | --------------------------------------------------------------------- | ----------------------------------------------- |
| **epic**      | a body of work that groups items; done when they all are              | `naima new epics "<title>"`                     |
| **gate**      | what must be settled before something may happen — a release, a merge | `naima gate new <name> "<title>"`               |
| **milestone** | a gate with a date, and optionally a version                          | `naima gate new … --due YYYY-MM-DD --version v` |

## Group work in an epic

```sh
naima new epics "Onboarding"
naima epic add onboarding bugs/first-run-crash todos/welcome-copy features/sample-project
```

An item is now `part-of` the epic. The epic's status is not set: it follows its items — `open` while any is open, `done` when every one is closed. Setting it by
hand against them is refused.

```sh
naima epic
```

```text
epics/onboarding  Onboarding  [open]  1 of 3 closed · gate beta
  waiting on: agent 1, human 1
  ✗ bugs/first-run-crash  First run crashes  (agent)
  ✗ features/sample-project  A sample project  (human)
```

For each open epic: how many of its items are closed, what it still waits for, and whose hands each needs — an agent, a person, a build ([triage](triage.md)).
`naima epic --all` lists the done ones too; `naima epic remove onboarding todos/welcome-copy` takes an item out.

## Declare a gate

When someone says "that's a gate for the beta":

```sh
naima gate new beta "Public beta" --says "the first outside users"
naima gate add beta bugs/first-run-crash epics/onboarding
```

The gate is written into the project's configuration, checked as it will be read; the items get `gate=beta` through the same checks as any `naima set`. An epic
on a gate stands for its items: the gate waits for them, not for the epic itself. An empty epic on a gate blocks it — nothing is planned yet.

By default a gate waits for **code**: a fixed item that still owes its proof does not block it. `--holds-on proof` makes it wait for every proof too
([prove and close](prove-and-close.md)).

```sh
naima gate show beta          # what blocks it, what is owed, whose hands
naima gate remove beta bugs/first-run-crash
```

## Give it a date: a milestone

```sh
naima gate new beta "Public beta" --due 2026-12-01 --version 0.9
```

```text
$ naima gates
beta — Public beta (version 0.9; due 2026-12-01, 17 days left): BLOCKED by 2
```

`naima gates`, `naima queue beta` and `naima summary` say the days left, `today`, or how many days overdue. Once the date has passed and the gate does not hold,
`naima check` warns (the check `milestone-overdue`) — a note, not a failure: a late milestone is news, not a broken project.

## Where it lives

Epics are items, in `naima-tracker/naima-data/epics/`. Gates are under `plugins.gates.options.gates` in `naima-tracker/naima-data/naima.json`
([configuration](config.md)), which `naima gate new` writes. Commit both with the work.
