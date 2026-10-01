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

## See when things happened: the timeline

```sh
naima view timeline
```

```text
2026-09-02  gate opened   gate beta (Public beta): the first of its 12 items reported
2026-09-14  record        build: Build 3 handed to the testers
2026-10-20  gate passed   gate beta (Public beta): the last of its 12 items resolved
2026-10-21  release       version tag v0.9
undated, not placed: epic finished 1 — an item without created, or resolved without closedOn or fixedOn
```

Nothing on it is stored: each event is worked out from the items and git every time. A gate opens on the day its first item was reported and passes on the day
its last item was resolved — archived (`closedOn`), else fixed (`fixedOn`) — once none is open; an epic the same, from its items. A release is a version tag
(`v0.9`, `1.2`), dated by its commit; a session is its note (`naima pass`). Something with no date is counted at the foot, never put at a guessed day.

Only what the tracker cannot know needs writing down — a decision taken in a meeting, a build handed out, a policy, an outside fact:

```sh
naima event 2026-09-14 "Build 3 handed to the testers" --kind build
```

Each is one file in `naima-tracker/naima-data/events/`. The timeline is also a tab of the window `naima ui` opens.

## Hold a declared list to its tests: coverage

A list the project keeps somewhere else — the paid features in a pricing file, the API endpoints in the code, the limits — is declared once, by where it is, and
read from there on every run: there is no copy to fall behind. In `plugins.gates.options.coverage` of `naima-tracker/naima-data/naima.json`:

```json
"coverage": {
  "paid": { "says": "the paid features", "json": "plans.json", "path": "plans.*.features" },
  "api": { "files": ["src/**/*.ts"], "pattern": "route\\(\"([^\"]+)\"" }
}
```

A JSON source names the file and where the list is in it (keys joined by dots, `*` for every element); an element that is an object is named by its `id`, or
the field `key` says. A files source names the files and a regular expression: each match is an entry, its first group when it has one.

A test names the entries it proves in `covers` — `naima set tests/sso-signs-in covers=sso`, or `paid:sso` to say which list. Then:

```text
$ naima coverage
paid — the paid features: 2 of 3 covered
  export  tests/export-works [passed]
  sso     NO TEST
  audit   tests/audit-log [open]
```

`naima coverage --check` exits 1 while any entry has NO TEST. A gate can require a list — `naima gate new launch "Launch" --coverage paid` — and is then
blocked by each entry with NO TEST. `naima check` notes a test whose `covers` names an entry the list no longer holds. Coverage is also a tab of `naima ui`.

## Where it lives

Epics are items, in `naima-tracker/naima-data/epics/`. Gates are under `plugins.gates.options.gates` in `naima-tracker/naima-data/naima.json`
([configuration](config.md)), which `naima gate new` writes; coverage lists beside them, under `plugins.gates.options.coverage`. The timeline's records are in
`naima-tracker/naima-data/events/`. Commit them all with the work.
