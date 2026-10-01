# Working on Naima

For anyone, person or agent, who changes this repository. Short on purpose:
each rule links the page that holds its reasoning.

## The rules

**The rules every project that uses Naima holds to — this one included — are
on one page, [the rules](docs/guide/rules.md), each marked enforced or
convention. They are not repeated here.** Among them are the owner's three:
[asking](docs/guide/rules.md#dont-ask-the-human-if-you-know-the-answer),
[documenting](docs/guide/rules.md#features-are-documented-as-part-of-their-implementation)
and [waiting for the go](docs/guide/rules.md#dont-start-implementing-until-the-owner-says-so).

This file holds only what applies to developing Naima itself: the modes, the
working rules below, and how a feature of Naima is documented — for people in
`docs/guide/`, for agents in `docs/agents/` and the skill, and in the
reference regenerated from the manifests with `deno task docs`
([the documentation rule](docs/develop/documentation.md)).

## Modes

Every agent obeys these. QUIET MODE and FAST MODE are of paramount importance.

**QUIET MODE.** Minimise tokens. Do not narrate work or explain routine steps.
Speak during a task only to ask permission before a high-risk step (files,
data loss, irreversible changes) or to state a moderately risky assumption in
one line. At the end: a 1–2 line summary, unless details are asked for. Never
repeat in chat what was just written somewhere durable (an item, a commit, a
doc): the chat says what changed and what the owner must do. Never paste raw
command output into chat or into context: redirect it to a file, check its
size, read only the relevant excerpt:
`cmd > out.log 2>&1; echo EXIT=$?; wc -l out.log`. Ack: "Quiet mode on".

**SIMPLE MODE.** Write so that reading costs no effort: the answer first; short,
structured, skimmable; bullets and concrete next actions ("now / next /
later"); at most one question at a time; track goal, state, blockers and next
step; point out hidden assumptions and unfinished loops; direct, calm,
practical. Ack: "Simple mode on".

**FAST MODE.** Do not spend wall-clock on waiting or repeating: run tests and
checks when a phase is finished, not after every edit; never wait with
`sleep` (background work announces itself; a long run writes a progress
file and is never blocked on silently); send independent commands, and
isolated experiments, in one round; do not re-read a file just written.
Ack: "Fast mode on".

**Reporting.** Answer only what was asked. Never a bare identifier: an item
id, a file, an acronym or a label is said together with what it is, every
time. "Measured" and "I think" are different registers; a guess never arrives
as a fact, and a claim is checked against the repository before it is
reported. No number without the number it is compared to. When corrected, fix
the thing, not the framing.

**Irreversible actions.** Ask first: deleting data or items, force-push,
rewriting published history, discarding someone's uncommitted work.

## Working rules

These apply only to this repository; the general ones are on
[the rules page](docs/guide/rules.md).

- **Naima tracks itself, and the tracker is managed by the locked commit.**
  `deno task naima <command>` runs the gitignored clone in
  `naima-tracker/naima/`, locked to a commit of `main` by
  `naima-tracker/naima-data/naima.json`; `deno task dev <command>` runs the
  working tree, as a test, and never writes the tracker. Every tracker change
  goes through the CLI, never by hand. A change the tracker is about to use is
  merged and pushed first, then `naima update` moves the lock to it:
  [Naima tracking itself](docs/develop/bootstrap.md).
- **English**, in code, docs, items and commit messages.
- **Documentation states what is, never how it came to be.** History lives in
  git and in the tracker.

## Before pushing

```sh
deno task verify    # typecheck, lint, format, tests, check (working tree and lock), reference current
node --test "src/**/*.test.ts" && bun test ./src/     # the same tests on Node and Bun
```

Architecture and the dependency rule: [architecture](docs/develop/architecture.md).
Everything else: [the documentation map](docs/README.md).
