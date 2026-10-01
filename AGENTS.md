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

The working modes every agent obeys (quiet, simple, fast, reporting,
irreversible actions) are this project's rules, kept as tracker data: read
them with `deno task naima rules --audience agents` at the start of work
([rules as data](docs/rules-as-data.md)). Until the lock moves to a commit
with the `rules` plugin, they are in
[the seed](naima-tracker/naima-data/features/project-rules-as-tracker-data-rules-type/attachments/seed-rules.sh).

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
