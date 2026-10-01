# Working on Naima

For anyone, person or agent, who changes this repository. Short on purpose:
each rule links the page that holds its reasoning.

## The owner's rules

1. **Don't ask the human if you know the answer.** Decide, act, report. Ask
   only for what is genuinely the owner's: a judgement of how something looks
   or feels, a decision reserved to them, a credential, a physical act. A
   question you could have answered yourself spends the most expensive
   resource in the project. How to tell the two apart:
   [asking the human](docs/flows/asking-the-human.md).
2. **Features are documented always, as part of their implementation.** A
   feature is not done until its documentation is in the same change. For a
   plugin contribution that means its manifest carries the documentation (a
   command its usage, options and an example; a gate how it decides) and
   `docs/reference.md` is regenerated with `deno task docs`; for anything else,
   the page under `docs/` that explains it. `deno task verify` fails otherwise:
   [the documentation rule](docs/documentation.md).
3. **Don't start implementing until the owner says so.** A request is not a
   work order. First its item must say what "done" is: for a feature, its
   behaviour, its boundaries and how it is documented; for a defect, its
   triage fields and the gesture that proves the fix. Then implementation
   waits for the owner's explicit go. Until then the only work allowed is
   writing and refining that definition. A requirement that arrives while work
   is running goes into the definition, never into the running work.

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

- **Naima tracks itself, and the tracker is managed by the locked commit.**
  `deno task naima <command>` runs the gitignored clone in
  `naima-tracker/naima/`, locked to a commit of `main` by
  `naima-tracker/naima-data/naima.json`; `deno task dev <command>` runs the
  working tree, as a test, and never writes the tracker. Every tracker change
  goes through the CLI, never by hand. A change the tracker is about to use is
  merged and pushed first, then `naima update` moves the lock to it:
  [Naima tracking itself](docs/bootstrap.md).
- **Write it down before fixing it.** A defect, a task or a request becomes an
  item first (`naima new`), then gets worked on. A fix with no trace is
  diagnosed from scratch next time: [reporting and triage](docs/flows/reporting-and-triage.md).
- **Triage what you touch.** An item you open, report or fix leaves with
  `impact`, `priority` and `confidence` set; `effort` is set only by someone
  who has looked at the code, never guessed.
- **Fixed, resolved, closed are three states.** Fixed: the code exists
  (`fixedOn`). Resolved: fixed and proven by an item that `verifies` it and has
  passed. Closed: resolved and archived with its proof (`naima close`). A
  branch does not close its own items on the strength of its own tests.
- **One isolated worktree per piece of work.** A worktree writes to its own
  branch and nowhere else; no shared mutable file — a registry is a directory
  of files named by uuid: [worktree isolation](docs/flows/worktree-isolation.md).
- **Every merge to the trunk is `git merge --ff-only`.** If it fails, stop:
  the resolution belongs on the branch, after merging the trunk into it:
  [closing a worktree](docs/flows/closing-a-worktree.md).
- **Evidence travels with the claim.** "It works" without a number, a log line
  or an attachment is not a verification.
- **English**, in code, docs, items and commit messages.
- **Documentation states what is, never how it came to be.** History lives in
  git and in the tracker.

## Before pushing

```sh
deno task verify    # typecheck, lint, format, tests, check (working tree and lock), reference current
node --test "src/**/*.test.ts" && bun test ./src/     # the same tests on Node and Bun
```

Architecture and the dependency rule: [docs/architecture.md](docs/architecture.md).
Everything else: [docs/README.md](docs/README.md).
