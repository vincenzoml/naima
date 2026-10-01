# Planned

Everything the documentation describes that Naima does not do yet, in one
place. Every other page says "planned" in one phrase and links here. Nothing
on this page exists in this version: `naima help` and `naima types` list
what does, and [what Naima is for](purpose.md#what-exists-today) sums it up.

Each entry says what it is, what you can do today instead, and an example.
The order is the order of the work: the first entries come first.

## Epics and milestones

- **[Epics](guide/glossary.md#epic)** as an item type: a large goal grouping
  features and todos. Example: "Replicate the 2024 study".
- **[Milestones](guide/glossary.md#milestone)**: a [gate](guide/glossary.md#gate)
  with a date, so `naima queue` can say what is late. Example: "draft results
  by 15 November".
- **Today:** a gate declared in `naima.json`, and a [todo](guide/glossary.md#todo)
  whose page lists its parts and the date in prose.

## Requirements, specifications and decisions

- **[Requirements](guide/glossary.md#requirement)** and
  **[specifications](guide/glossary.md#specification)** as item types,
  proven like any other item by a test or a property linked `verifies`.
  Example: "every number in table 2 comes from the raw data by a script".
- **[Decisions](guide/glossary.md#decision)** as an item type: the choice,
  its reason, and who took it, so "never asked twice" is checked rather than
  remembered. Example: "the paper targets the journal, not the conference".
- **Today:** a todo with `kind=decision`, and the owner's working style as
  [project rules](guide/write-a-project-rule.md).

## Item types for other work

Packs of item types for work that is not software: experiments and analyses
whose evidence is a reproducible run; sections and reviews of a paper.
**Today:** bugs, todos, features and tests fit most of this already ("figure
3 uses last year's data" is a bug), and a project can add its own types with
a [plugin](guide/add-a-plugin.md).

## Commands for every action

Every action an agent takes on an item has a command, so each is recorded
the same way and can be checked. Opening, fields and title, triage, links,
the description (`naima describe`), notes (`naima note`), claims, proof and
closing have one. Missing today:

- **Attaching a file** to an item's `attachments/`, with the consent of whoever
  owns it recorded on the item when it is the owner's material. **Today:** the
  file is copied in by hand.
- **Moving an item to another type** (a bug that turns out to be a request).
  **Today:** a new item is opened in the right type and the old one linked
  `duplicate-of` it.

## Worktree names and claim files

- **A naming policy** for [worktrees](guide/glossary.md#worktree) and
  branches, checked: who works, and on what.
- **A check that every worktree carries a [claim file](guide/glossary.md#claim-file).**
- **Today:** the [opening flow](agents/opening-a-worktree.md) names the
  branch `<who>/<what>` and claims before any work, by convention.

## The non-stop method

A way of working in which agents keep going, without the owner having to
restart them, until only the owner's work is left.

1. Before starting, the coordinator writes an explicit target: a work list,
   an epic, or a gate.
2. A timer wakes it every three minutes; each time it asks "am I done, or did
   I stop?" and resumes what stopped.
3. It stops only when what is left on the target needs only the owner
   (`naima queue <gate> --human` computes it for a gate).
4. Its deliverable is the owner's ordered action list, each line saying why
   it is the owner's.

**Today:** the coordinator sets a timer so that the owner is never the
reason work resumes ([the coordinator and the workers](agents/coordinator-and-workers.md)).

## Model checkers and the strength of evidence

- **Real [model checkers](guide/glossary.md#model-checker) as verifiers**:
  mCRL2 first, VoxLogicA (a tool for checking properties of images) where it
  applies.
- **The mCRL2 model of Naima's own claims** ("no claim is ever lost") as a
  property in Naima's own tracker.
- **A check for red-then-green**: a test must be shown to fail on the old
  work and pass on the new.
- **A written order of how strong each kind of evidence is**: a run beats a
  reading of the code, a measurement beats a report.
- **Today:** properties, `naima verify` and expiring proofs work, with one
  example verifier, `naima/src/plugins/verifier/adapters/example-regex.ts`
  ([prove and close](guide/prove-and-close.md#properties-proven-by-a-tool)).

## Metrics

A metric is a named measurement and the command that measures it: test time,
coverage, warnings, size, how long an analysis runs. It is recorded on every
commit as evidence, compared with its baseline (no number without a
comparison), shown as a trend, and usable as a gate ("coverage must not
drop"). **Today:** `naima triage` counts how many items have each triage
field set; nothing measures the work itself.

## Structuring a project from the start

An [epic](guide/glossary.md#epic) of its own for the first decisions: which
language or languages, splitting the work into small independent parts,
keeping logic separate from data. Example: data in plain files, one script per
table, no number typed by hand into the paper. **Today:** the agent proposes
these choices in chat, and the owner's answers become
[project rules](guide/write-a-project-rule.md).

## Design, skills and a dashboard

- **Designing what users see**: support for planning and checking a user
  interface.
- **Skills from GitHub**: an item or flow points to a
  [skill](guide/glossary.md#skill) published on GitHub instead of copying it.
- **A dashboard**: a visual page of the project's state. **Today:** `naima
  summary --markdown` prints it as text you can paste anywhere.

## A pointer in the agent's instruction file

`naima init` offering, when asked, to add one line to the project's agent
instruction file (such as `AGENTS.md` or `CLAUDE.md`) pointing at the
[skill](agents/skill.md). **Today:** the installer's instructions tell the
agent to do it ([working with AI agents](guide/working-with-agents.md#get-an-agent-going)).

## Roles

The jobs in [the company of agents](purpose.md#the-company-and-its-roles)
not yet written as practice:

- **Release manager**: proposes a release when the gates hold; never decides
  it.
- **Documentarian**: writes the documentation with the feature. The rule it
  serves is already a check
  ([features are documented](guide/rules.md#features-are-documented-as-part-of-their-implementation)).
- **Announcer**: release notes, changelog, site, announcements, only for
  what shipped and was checked.
- **Business**: options for licence, funding, sponsorship and adoption, for
  the owner to decide.
