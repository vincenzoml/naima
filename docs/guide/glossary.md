# Glossary

Every term Naima uses, defined once. Every other page links its terms here.
Terms are grouped by subject; within a group, the order is the order you meet
them in.

## The tracker

### Project

The git repository Naima tracks: your software, with one folder,
`naima-tracker/`, added at its root.

### Tracker

The folder `naima-tracker/` and what it holds: the [program](#program-directory)
and the [data](#data-directory). "The tracker" also means the state it
records: every [item](#item) and its [links](#link).

### Data directory

`naima-tracker/naima-data/`: everything the project records — its items,
[claims](#claim), [session notes](#session-note) and `naima.json` (the
[lock](#lock) and the [configuration](config.md)). It is committed with the
project. Its layout is fixed by [the format](../reference/format.md).

### Program directory

`naima-tracker/naima/`: the copy of Naima the project runs. It holds only the
files that run Naima, is ignored by git, and is replaced whole on every
[update](#update). Nothing of yours lives in it.

### Item

One thing the project tracks: a bug, a todo, a feature, a test, a property.
An item is a directory under the data directory, `<type>/<slug>/`, holding
`README.md` (its page: the prose), `meta.json` (its [fields](#field)) and
`attachments/` (its [evidence](#evidence)).

### Type

The kind of an item, and the directory it lives in: `bugs`, `todos`,
`features`, `tests`, `properties`, and `closed` (the archive). Each type has
its own [statuses](#status). Plugins can add types; `naima types` lists those
in use.

### Status

Where an item is in its life: `open`, `partial`, `passed`, `shipped`… Every
status is in one of two categories, **open** (still to do) or **done**
(settled). A status may also [prove](#proves) or [refute](#refutes).

### Field

A named value in an item's `meta.json`: `status`, `priority`, `fixedOn`,
`gate`… Which fields exist depends on the loaded [plugins](#plugin); the
[reference](../reference/reference.md) lists every one. Set them with
`naima set`.

### Id

An item's permanent name, a uuid such as
`5353a7eb-0fbc-4066-ae70-f65e4c3b2885`. It never changes, and [links](#link)
hold it.

### Slug

An item's readable name, made from its title: `greet-sh-says-helo-instead-hello`.
It may change; the [id](#id) does not. On the command line an item can be
named by its id, by `type/slug`, by its slug, or by any piece of a slug that
matches exactly one item (`greet-sh-says`).

### Section

A heading an item is grouped under on its [board](#board). Free text, set with
`--section` or `naima set <item> section=…`.

### Area

A field: where an item lives — the part of the software somebody would have
open while working on it ("export", "login screen").

### Kind

A field: the mode of work an item demands — code, decision, research,
writing.

## Links

### Link

A typed connection from one item to another, made with `naima link`. Only the
direction written is stored; the reverse is worked out when read, so the two
can never disagree.

### Relation

The type of a link: `verifies` / `verified-by`, `blocks` / `blocked-by`,
`duplicate-of`, `relates-to`.

### Verifies

The relation from a [gesture](#gesture) (a test or a property) to the item it
proves. Its reverse is `verified-by`, read "is proven by".

## From report to close

### Owner

The person the project answers to: the one who decides what is built and
judges what only a person can judge.

### Report

What someone says, sees or finds, written as an item: the words verbatim, the
evidence, the consequence ([file a bug](file-a-bug.md)).

### Triage

Setting the four fields that rank an item: [impact](#impact),
[priority](#priority), [confidence](#confidence) and [effort](#effort)
([triage](triage.md)).

### Impact

A triage field: if nobody touches this, who notices? `blocker` (stops a
release or loses work), `high` (a newcomer would hit it and not come back),
`medium` (noticeable, worked around), `low` (cosmetic).

### Priority

A triage field: when. `now`, `next`, `later`, `parked`.

### Confidence

A triage field: do we understand it? `measured`, `diagnosed`, `reported`,
`unclear`.

### Effort

A triage field: what it costs, `S` (under an hour), `M` (half a day), `L` (a
day or two), `XL` (more, or unknown). Set only by someone who has looked at
the code, never guessed.

### Urgency

The order "most urgent first" in every list, worked out from the triage
fields and the [gates](#gate) an item is on. Never stored.

### Fixed

The code change exists: the item's `fixedOn` field is set. Nothing is proven
yet.

### Gesture

What someone does to prove a claim: run a command, open a screen and look,
measure. Written as a [test item](#test-item) so anyone can perform it later.

### Test item

An item of type `tests`: a [gesture](#gesture) and its result. Linked
`verifies` to what it proves. Its status `passed` [proves](#proves), `failed`
[refutes](#refutes).

### Property

An item of type `properties`: a statement about the software checked by a
[verifier](#verifier). `holds` proves, `violated` refutes.

### Proves

A status that counts as evidence for what the item [verifies](#verifies):
`passed`, `holds`.

### Refutes

A status that counts as evidence against what the item verifies: `failed`,
`violated`. One refuting item outweighs any number that prove.

### Resolved

[Fixed](#fixed), and proven: an item that verifies it is in a status that
proves, and nothing verifying it refutes.

### Closed

Resolved, and archived by `naima close` into `closed/`, carrying its proof, so
a regression is recognised when it comes back.

### Evidence

What backs a claim: a log line, a number, a screenshot, a command's output,
kept in the item's `attachments/`. "It works" without it is not a proof.

### Run by

The field `runBy`: whose hands the proving gesture needs. `agent` (a command
settles it), `agent-hands` (an agent driving the running software), `human`
(only a person), `build` (an artefact nobody here makes).

### Human because

The field `humanBecause`: why only a person can perform a gesture marked
`runBy: human`. `judgement`, `decision`, `credential` or `physical`
([what is genuinely the owner's](../agents/asking-the-human.md#what-is-genuinely-the-owners)).

### Beta marker

A comment in the project's own source, `naima:beta <item> <what>`, that marks
behaviour shipped without proof and names the item whose passing would prove
it. `naima beta` lists them; `naima check` fails on one that names nothing or
outlives its proof.

## Seeing where things stand

### Board

A type's items grouped by [section](#section), most urgent first:
`naima board bugs`.

### Gate

A named condition — a release, a merge — backed by items: an item joins it by
carrying `gate: <name>`. A gate **holds** when nothing on it blocks.
`holdsOn: "code"` waits for code, not proof; `holdsOn: "proof"` waits for
every open item ([read the board, the queue and the gates](read-the-board.md)).

### Queue

The open items on a gate, split by whose hands their proof needs:
`naima queue`.

### Summary

Where the project stands, in one screen: `naima summary`.

### Check

One rule `naima check` holds the tracker to. A check reports a **problem**,
which fails `naima check`, or a **note**, which does not. A project can weigh
each check `problem`, `note` or `off` ([configuration](config.md#check-severity)).

### Invariant

What a check holds true. `naima check` ends with `all invariants hold` when
every one does.

### Write hook

A rule run on every change to an item, which can refuse it: a branch closing
its own claimed items, a property set to `holds` by hand.

### Derived

Computed when asked and never written down: boards, queues, gate states,
urgency and summaries. No stored copy can go stale.

## Working in parallel

### Branch

A line of work in git. Each piece of work has its own.

### Trunk

The branch releases come from, usually `main`.

### Worktree

A second checkout of the same repository, in its own folder, standing on its
own branch. One worktree per piece of work, so parallel sessions never write
to one another's files ([work on several branches at once](several-branches.md)).

### Fast-forward

A merge that only moves the trunk forward onto the branch, adding no merge
commit: `git merge --ff-only <branch>`. It succeeds only when the branch
already contains the trunk.

### Claim

A note that a branch is working on some items, written by `naima claim` as one
file of its own in `claims/`, and dropped by `naima release`. Claims are
read from every local branch, so everyone sees who holds what.

### Session note

A note of what a session changed, proved and left, written by `naima pass` as
one file of its own in `passes/`. `naima summary` shows the newest.

## Running Naima

### Naima

The tracker itself, and the command that runs it: `naima <command>`, short for
`deno run -A naima-tracker/naima/naima.ts <command>`.

### Deno

The program that runs Naima's code. The one thing installed on the machine,
once ([install](install.md#deno-once-per-machine)).

### Launcher

`naima-tracker/naima/naima.ts`, the file every `naima` command starts from. It
lets the program read the project, write only inside `naima-tracker/`, and run
only `git` and the tools its plugins declare
([the permissions](install.md#the-permissions)).

### Source

Where the project's copy of Naima comes from: a git repository, Naima's own on
GitHub by default, or a [fork](#fork). Recorded in `naima.json`.

### Lock

The `source` and `commit` in `naima.json`: exactly which Naima runs the
project. Everyone who works on the project runs that one.

### Alignment

What every run does first: make the program directory exactly the locked
commit, cloning it when it is missing. It never overwrites work and never
pulls.

### Dist branch

The branch of Naima's repository a project clones: only the files that run
Naima, without its tests or its own tracker
([the dist branch](install.md#the-dist-branch)).

### Update

Moving the [lock](#lock) to a newer Naima: `naima update`, as one commit to
review ([update Naima](update-naima.md)).

### Format

The version number of the data's layout, in `naima.json`. It moves only with a
[migration](#migration).

### Migration

The step that rewrites the data from one [format](#format) to the next, run by
`naima update`, forward only.

### Carry

How the program directory is kept: an ignored `clone` (the default),
`vendored` (committed as plain files) or a git `submodule`
([how the program is carried](install.md#how-the-program-is-carried)).

### Fork

Your own copy of Naima's repository, changed to fit the project. A project
runs it by naming it as its [source](#source)
([modifying Naima](install.md#modifying-naima)).

## Plugins

### Plugin

A piece of Naima that adds item types, fields, checks, commands, gates or
views. Almost everything is a plugin; the small core only loads them.

### First-party plugin

A plugin that ships with Naima: `trackers`, `coordination`, `triage`,
`gates`, `beta-markers`, `verifier`, `docs`. All are on unless the project
switches one off.

### Third-party plugin

A plugin from anywhere else — a colleague, another repository — added in
`naima.json` and pinned so that only the reviewed code runs
([add a plugin someone gave you](add-a-plugin.md)).

### Verifier

An adapter to a formal-methods tool, such as a model checker. `naima verify`
runs it on a [property](#property) and attaches the run as evidence.

### Manifest

What a plugin declares about itself and each thing it adds, documentation
included. The [reference](../reference/reference.md) is generated from the
manifests.

## Agents

### Agent

An AI that works on the project: reads items, writes code, runs checks, files
what it finds ([working with AI agents](working-with-agents.md)).

### Skill

A page an agent tool loads to learn how to work with Naima:
`skills/naima/SKILL.md` in the program directory
([the Naima skill](../agents/skill.md)).

### Flow

A written procedure an agent, or a person, follows: opening a worktree,
reporting, closing. The flows are [the pages for agents](../agents/README.md).

### Coordinator

In a session staffed with agents, the one that talks to the owner and hands
work to the workers; it does not do the work itself.

### Worker

An agent doing one piece of work, in its own worktree, on its own branch.

### Rule

Something every project that uses Naima holds to, written once on
[the rules page](rules.md), marked as checked by Naima or kept by convention.
