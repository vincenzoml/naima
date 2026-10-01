# Tutorial: from an empty repository to a closed bug

Twenty minutes, start to finish. You will install Naima in a small project,
file a bug, rank it, look at where the project stands, fix the bug, prove the
fix, and close it. You type every command yourself; nothing here needs you to
read or write code beyond changing one word in a one-line script.

In everyday use an agent types these commands for you
([how the project runs](how-the-project-runs.md)); doing them once by hand
shows what it does. The project here is a tiny script, but the same steps
run a data analysis or a paper.

Every output below is what the commands printed when this tutorial was run.
Yours differs only in the item ids, the dates, the commit and the folder.

What you need: a terminal, and git. Naima installs the rest.

## 1. A project to track

Naima tracks a git repository. Make a tiny one, with a script that has a typo:

```console
$ mkdir demo && cd demo
$ git init -q
$ printf '#!/bin/sh\necho "Helo, $1"\n' > greet.sh
$ git add greet.sh && git commit -qm "A greeting"
$ sh greet.sh Ada
Helo, Ada
```

That "Helo" is the bug you will track.

## 2. Install Naima

From the root of the repository, one line (on Windows, PowerShell:
`irm https://vincenzoml.github.io/naima/install.ps1 | iex`):

```console
$ curl -fsSL https://vincenzoml.github.io/naima/install.sh | sh
naima: cloning https://github.com/vincenzoml/naima.git (dist) into naima-tracker/naima
wrote naima-tracker/: README.md, .gitignore, naima-data/naima.json — locked to https://github.com/vincenzoml/naima.git at 89530499e809
next: naima new bugs "<the first thing to do>"
0 items, 31 checks

all invariants hold

Naima is installed in ~/demo.

Next:
  git add naima-tracker && git commit -m "Track this project with Naima"
  alias naima='deno run -A "$(git rev-parse --show-toplevel)/naima-tracker/naima/naima.ts"'

Agents: read naima-tracker/naima/skills/naima/SKILL.md
```

What happened: the installer put a copy of Naima in `naima-tracker/naima/`
(the [program directory](glossary.md#program-directory), which git ignores),
and `naima init` wrote the [data directory](glossary.md#data-directory),
`naima-tracker/naima-data/`, [locked](glossary.md#lock) to that exact copy.
Then `naima check` ran every [check](glossary.md#check): with no items yet,
all hold. If Deno was missing, the installer installed it first and said so.

Do the two things it suggests. The alias lets you type `naima` instead of
the long command; add it to your shell's startup file to keep it.

```console
$ git add naima-tracker && git commit -qm "Track this project with Naima"
$ alias naima='deno run -A "$(git rev-parse --show-toplevel)/naima-tracker/naima/naima.ts"'
```

## 3. File the bug

Write it down before you fix it. The title says what happened, not what to do:

```console
$ naima new bugs "greet.sh says Helo instead of Hello"
naima-tracker/naima-data/bugs/greet-sh-says-helo-instead-hello/  f7c43c69-d654-49e5-9c1f-c9c30488afff
```

The bug is now an [item](glossary.md#item): a folder with a page
(`README.md`), its fields (`meta.json`) and a place for evidence
(`attachments/`). The long string is its permanent [id](glossary.md#id);
the folder name is its [slug](glossary.md#slug). From now on you can name it
by any piece of the slug that is unique, such as `greet-sh-says`.

Open `README.md` in that folder in your editor and write what you saw, in
your own words:

```markdown
# greet.sh says Helo instead of Hello

`sh greet.sh Ada` prints `Helo, Ada`. Anyone who runs the greeting sees the typo.
```

## 4. Triage it

[Triage](glossary.md#triage) ranks the bug against everything else. Say how
bad it is ([impact](glossary.md#impact)), when it should be done
([priority](glossary.md#priority)) and how well you understand it
([confidence](glossary.md#confidence)):

```console
$ naima triage set greet-sh-says impact=high priority=now confidence=measured
bugs/greet-sh-says-helo-instead-hello: impact=high priority=now confidence=measured
```

The fourth field, [effort](glossary.md#effort), waits until someone has
looked at the code: it is never guessed.

## 5. See where the project stands

The [board](glossary.md#board) of a type, most urgent first:

```console
$ naima board bugs
# Bugs

1 open, 0 done

## (no section)
  open      greet.sh says Helo instead of Hello  — bugs/greet-sh-says-helo-instead-hello
```

How many bugs are left, as three numbers that are never added together:

```console
$ naima bugs
bugs: 1 open
  unfixed (no code)     1
  fixed, not proven     0
  resolved, not closed  0
    bugs/greet-sh-says-helo-instead-hello  greet.sh says Helo instead of Hello
```

The [queue](glossary.md#queue): open items on the project's
[gates](glossary.md#gate), the conditions a release waits on. This project
has declared none yet, so it is empty
([read the board, the queue and the gates](read-the-board.md) shows how to
add one):

```console
$ naima queue
all gates: 0 open — agent 0, human 0, build 0, unclassified 0
  with no code yet: 0; owing only proof: 0
```

Everything in one screen:

```console
$ naima summary
── items
  bugs            1 open     0 done

── bugs
  1 unfixed · 0 fixed, unproven · 0 resolved, not closed

── next up
  high    now     ·       bugs/greet-sh-says-helo-instead-hello  greet.sh says Helo instead of Hello
  (0 untriaged, 1 without effort — naima triage missing)

── gates
  properties       holds
```

(`properties` is a gate every project has: every formal
[property](glossary.md#property) holds. With none, it holds.)

## 6. Fix it

Change `Helo` to `Hello` in `greet.sh`, with your editor or with this line:

```console
$ printf '#!/bin/sh\necho "Hello, $1"\n' > greet.sh
$ sh greet.sh Ada
Hello, Ada
```

Record that the code exists — the bug is now [fixed](glossary.md#fixed) — and,
now that you have seen the code, its effort (`S`, under an hour):

```console
$ naima set greet-sh-says fixedOn=2026-10-01
bugs/greet-sh-says-helo-instead-hello: fixedOn=2026-10-01
$ naima triage set greet-sh-says effort=S
bugs/greet-sh-says-helo-instead-hello: effort=S
```

Naima notices that nothing proves the fix yet. That is a note, not a failure:

```console
$ naima check
1 items, 31 checks

notes (not failures):
  · bugs/greet-sh-says-helo-instead-hello is fixed, and nothing verifies it

all invariants hold
```

## 7. Say how to prove it

A fix is a claim. The [proof](glossary.md#proof) is a [gesture](glossary.md#gesture) someone can
perform, written as a [test item](glossary.md#test-item) and linked to the bug
it [verifies](glossary.md#verifies). `runBy=agent` says a command settles it,
so no person is needed ([run by](glossary.md#run-by)):

```console
$ naima new tests "greet.sh greets with Hello" --set runBy=agent
naima-tracker/naima-data/tests/greet-sh-greets-hello/  3194a839-43bd-4e1d-8e51-861cb0cb04a5
$ naima link greet-sh-greets verifies greet-sh-says
tests/greet-sh-greets-hello verifies bugs/greet-sh-says-helo-instead-hello
$ naima triage set greet-sh-greets impact=high priority=now confidence=measured effort=S
tests/greet-sh-greets-hello: impact=high priority=now confidence=measured effort=S
```

Write the gesture on the test's page, `README.md` in its folder, so that
someone who was not here can perform it:

```markdown
# greet.sh greets with Hello

Run `sh greet.sh Ada`. It must print exactly `Hello, Ada`.
```

The test is on its own board, open, and the note from step 6 is gone:

```console
$ naima board tests
# Tests

1 open, 0 done

## (no section)
  open      greet.sh greets with Hello  — tests/greet-sh-greets-hello
$ naima check
2 items, 31 checks

all invariants hold
```

Try to close the bug now, and Naima refuses: fixed is not proven.

```console
$ naima close greet-sh-says
naima: bugs/greet-sh-says-helo-instead-hello is fixed: closing takes fixedOn and a verified-by item that has passed
```

## 8. Perform the gesture, keep the evidence

Run it, and keep what it printed in the test's `attachments/` folder:
[evidence](glossary.md#evidence) travels with the claim. `naima attach`
copies it there and records that it is your own (`--own`); a file someone
else gave you goes in with their yes instead (`--consent "…"`).

```console
$ sh greet.sh Ada | tee run.txt
Hello, Ada
$ naima attach greet-sh-greets run.txt --own
tests/greet-sh-greets-hello: attached run.txt (your own)
$ naima set greet-sh-greets status=passed
tests/greet-sh-greets-hello: status=passed
```

## 9. Close it

The bug is [resolved](glossary.md#resolved): fixed, and proven by a test that
passed. Close it, which moves it to the archive with its proof:

```console
$ naima close greet-sh-says
closed → closed/greet-sh-says-helo-instead-hello
$ naima bugs
bugs: 0 open
  unfixed (no code)     0
  fixed, not proven     0
  resolved, not closed  0
$ naima check
2 items, 31 checks

all invariants hold
```

The closed item keeps everything, including what proves it:

```console
$ naima show greet-sh-says
greet.sh says Helo instead of Hello
closed/greet-sh-says-helo-instead-hello  f7c43c69-d654-49e5-9c1f-c9c30488afff  [closed]
  created: 2026-10-01
  impact: high
  priority: now
  confidence: measured
  triagedOn: 2026-10-01
  fixedOn: 2026-10-01
  effort: S
  closedFrom: bugs
  closedOn: 2026-10-01
  is proven by tests/greet-sh-greets-hello [passed]  (inverse)

# greet.sh says Helo instead of Hello

`sh greet.sh Ada` prints `Helo, Ada`. Anyone who runs the greeting sees the typo.
```

Commit the fix and the tracker together, as one change:

```console
$ git add -A && git commit -qm "Fix the greeting, prove it, close the bug"
$ git status --short
```

## What you did

- **Installed** Naima: one folder, `naima-tracker/`, and nothing else in the
  project changed.
- **Filed** a bug before fixing it, and **triaged** it.
- **Read** the board, the bug count, the queue and the summary — all worked
  out when asked, never stored.
- **Fixed** it, **proved** it with a test item that passed, kept the evidence,
  and **closed** it. Naima refused to close it until the proof existed.

## Next

- Everyday tasks, one page each: [the guide](README.md).
- The ideas behind what you just did: [concepts](concepts.md).
- The rules every project holds to: [rules](rules.md).
- Letting AI agents do this for you: [working with AI agents](working-with-agents.md).
- Where the documentation of the copy you run is, from inside the project:

```console
$ naima guide
Naima 89530499e809, data format 2, at naima-tracker/naima
Read these as files; they are the documentation of the Naima that runs:
  skill    naima-tracker/naima/skills/naima/SKILL.md
  index    naima-tracker/naima/docs/README.md
  guide    naima-tracker/naima/docs/guide/README.md
  rulebook naima-tracker/naima/docs/guide/rules.md
  agents   naima-tracker/naima/docs/agents/README.md
  format   naima-tracker/naima/docs/reference/format.md
  install  naima-tracker/naima/docs/guide/install.md
```
