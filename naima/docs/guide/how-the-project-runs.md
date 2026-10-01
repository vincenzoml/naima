# How the project runs

How work moves through a project that uses Naima, from the moment you say
something to the moment it is done and proven. You do not run any of this
yourself: [agents](glossary.md#agent) do, and the commands are shown so you
can see what happens and check it. Each step links the page with the detail.

## From a report to a close

Every piece of work follows the same [flow](glossary.md#flow):

```
report → file → triage → claim → work → prove → close
```

| Step | Who | What happens | Command |
|---|---|---|---|
| **Report** | you, or anyone | you say what you noticed, in chat, in your own words; or you write the item yourself | — |
| **File** | an agent | the report becomes an [item](glossary.md#item) at once, before anyone works on it | `naima new bugs "Figure 3 uses last year's data"` |
| **Triage** | an agent | it rewrites the report as a clear description in its own words, checks for duplicates and links them, and ranks it | `naima triage set <item> impact=high priority=now confidence=reported` |
| **Claim** | the agent that takes the work | it opens its own [worktree](glossary.md#worktree) and records that it holds the item, so nobody else starts it unknowingly | `naima claim <item> --note "why"` |
| **Work** | that agent | it does the work — code, an analysis script, a paragraph — in its own copy, in small [commits](glossary.md#commit) | git, handled by the agent |
| **Prove** | that agent, then another | the [proof](glossary.md#proof) is written as its own item and performed; what it showed is saved as [evidence](glossary.md#evidence) | `naima new tests "…"`, `naima link <test> verifies <item>`, `naima set <test> status=passed` |
| **Close** | someone other than the one who did the work | from the main branch, after the merge, the item moves to the archive with its proof | `naima close <item>` |

Three things are checked, not trusted:

- **Fixed is not done.** An item is [fixed](glossary.md#fixed) when the work
  exists, [resolved](glossary.md#resolved) when something proves it, and
  [closed](glossary.md#closed) when archived. `naima close` refuses anything
  not proven.
- **Whoever did the work does not close it.** `naima close` refuses on the
  branch that [claims](glossary.md#claim-file) the item
  ([the rule](rules.md#whoever-fixes-does-not-also-close)).
- **A proof counts only for what it was run on.** If what it proved changes,
  it stops counting until it runs again
  ([prove and close](prove-and-close.md)).

**Example (a paper with colleagues).** A co-author writes "section 4
contradicts the abstract". The agent files a bug and writes which sentence
contradicts which; [triage](glossary.md#triage) finds an older report of the same problem and
links it `duplicate-of`; a worker claims it, rewrites the paragraph on its own
branch, and files a test item "every claim in the abstract appears in the
body", which another agent performs and marks `passed`; then the item is
closed from the main branch.

The detail: [file a bug](file-a-bug.md), [file a feature](file-a-feature.md),
[triage](triage.md), [prove and close](prove-and-close.md), and for agents
[reporting and triage](../agents/reporting-and-triage.md).

## Planning

What you would like is filed as a [feature](glossary.md#feature) in status
`requested`. Before any work starts, the agent writes on it what "done"
means — the behaviour, its limits, how it is documented — and waits for your
go ([the rule](rules.md#dont-start-implementing-until-the-owner-says-so)).
Smaller pieces of work are [todos](glossary.md#todo).

```sh
naima new features "Export to PDF with the figures in colour"
naima board features
```

Epics, milestones, requirements and specifications as items are
[planned](../planned.md#epics-and-milestones); today a todo or a feature
whose page lists its parts stands in for an epic.

## Gates

A [gate](glossary.md#gate) is what a release waits on: an item joins it by
carrying `gate=<name>`, and the gate holds when nothing on it blocks.

```sh
naima set export-drops gate=v1
naima gates v1 --check         # fails while anything on v1 is open
naima queue v1 --human         # what on v1 needs you, each with why
```

The [queue](glossary.md#queue) splits what is left by whose hands it needs:
an agent's, a person's, or a build machine's. A release is never cut on an
open gate. Detail: [read the board, the queue and the gates](read-the-board.md);
adding a gate: [configure the project](configure-the-project.md).

## Work that lasts longer than one session

Agents forget between [sessions](glossary.md#session); the project does not,
because everything is written down in files:

- **A session note** at the end of every session: `naima pass "what changed,
  what is proven, what is left"`. The next agent reads it in `naima summary`.
- **A claim file** for every piece of work in progress: `naima claim`, then
  `naima release` when done. `naima claims` shows who holds what, across
  every branch.
- **One worktree per piece of work**, so two agents working at once never
  write into each other's files
  ([work on several branches at once](several-branches.md)).
- **One coordinator** talks to you; workers do the work in the background
  and report to it ([the coordinator and the workers](../agents/coordinator-and-workers.md)).

A naming policy for worktrees with a check that each carries a claim file,
and a way of working that keeps going until only your work is left, are
[planned](../planned.md#worktree-names-and-claim-files).

## Decisions

An agent asks you only what is genuinely yours — a judgement, a decision, a
credential such as a password, or a physical act — one question at a time,
with the answer it would give. Anything it can find out itself, it does. A
permission you gave stays given
([what an agent will ask you](working-with-agents.md#what-an-agent-will-ask-you)).

Your standing choices become [rules](glossary.md#rule) of the project, read
by every agent at the start of work:

```sh
naima new rules "Ask before deleting" --set audience=agents --set strength=must
naima rules --audience agents
```

Detail: [write a project rule](write-a-project-rule.md). Decisions as items
of their own are [planned](../planned.md#requirements-specifications-and-decisions).

## What agents do with git

Every version of the work is kept by git. You never type a git command:
agents install git if it is missing, start a repository if there is none,
keep secrets and private data out of it, and save work in small commits they
never rewrite ([git, handled for you](../agents/git-for-the-owner.md)).

## Then the commands

Each step above is a command; the [guide](README.md#everyday-tasks) has a page
per task, and the [reference](../reference/reference.md) documents every
command, generated from the code.
