# What Naima is for

Read this first. Every other page explains how a piece works; this one says
what Naima is, what it manages for you, and what it does not do yet. Each
term links, the first time it appears, to its one definition in the
[glossary](guide/glossary.md). "[Planned](planned.md)" means Naima does not
have it yet.

## What Naima is

Naima is an enabling technology for people who are not technicians. It lets
experts in their own field, who are not remotely programmers, get excellent
results from AI agents. It works on anything that benefits from keeping
every version: software, a scientific data analysis, a paper written with
colleagues, a plan — or several of these at once in one project.

Used through an AI [agent](guide/glossary.md#agent), Naima is a decision
support system: a tool for running long-lived work and making informed
decisions about it. It is for the [owner](guide/glossary.md#owner), the
person whose work it is. You say in plain words what you want or what is
wrong. Agents do the machine work: they write it down, plan it, carry it out,
check it and keep the proof.

**Why so much of this sounds like software.** Naima's methods come from
software engineering, because building software is the most demanding case of
long-lived, shared, versioned work, and it is where the strongest tools
exist: tests, version control, mathematical checking of designs. The same
discipline applies to any versioned work, whether a data analysis, a paper
with colleagues or a plan: work written down, evidence for every claim,
decisions recorded, gates before anything goes out. So most examples below
are software, and today's built-in item types (bugs, todos, features, tests)
are shaped for software; `naima types` lists them. Packs of item types for
other kinds of work are [planned](planned.md#item-types-for-other-work).

**A quiet way to manage decisions.** When the agents can go ahead on their
own, they do, and you hear nothing. When something is yours to decide, Naima
helps you understand it in your own terms and your own words, not a
technician's. `naima queue --human` lists what is waiting for you, each item
with the reason it is yours ([asking the human](agents/asking-the-human.md)).

**The silent company that runs for you.** Behind the conversation there is a
team of agents with separate jobs: engineering, testing, judging evidence,
releasing, documenting, announcing, even the business side. The agents do the
work; you only decide. The jobs are listed in
[their own section](#the-company-and-its-roles) below.

**A first example: turning vibe coding into science.** Vibe coding means
asking an AI to build software and hoping it worked. With Naima, the same
request goes through industry-grade practices and tools, without you needing
to know them, so that what gets built is robust, maintainable and solid. A
domain expert who has never programmed can build serious software this way.
[One example, start to finish](#one-example-start-to-finish) shows both.

**An enabler for software engineering and formal methods.** Software
engineering is the discipline of building software that lasts: written
requirements, tests, reviews, releases. [Formal
methods](guide/glossary.md#formal-methods) are tools that check a design
mathematically. Both are usually out of reach for anyone who is not a
specialist. Naima makes agents use them by default, and records what they
did.

**What you need, and how it stays out of your way.** You need no knowledge
of git, code, Deno or Node (the programs Naima runs on), or professional
project management. You need an AI agent. The agent installs what is missing:
git, and Deno (the installer does it: [install](guide/install.md)). Naima
lives inside the project's [repository](guide/glossary.md#repository), the
folder in which git keeps every version of the work. It uses one folder
there, `naima-tracker/`, and changes nothing outside it. It needs no server,
no account and no internet connection. You never have to open one of its
files or learn one of its commands; the agents do that, and git too
([git, handled for you](agents/git-for-the-owner.md)). The commands below are
what they type; `naima` is short for `deno run -A naima-tracker/naima/naima.ts`.

## What Naima manages

How each of these runs, step by step, is on
[how the project runs](guide/how-the-project-runs.md).

### Reporting and issue management

Whatever you notice reaches the project, and nothing said is lost. You can
report in chat ("figure 3 looks wrong"), correct a report later, or, if you
are comfortable with files, write the [item](guide/glossary.md#item)
yourself. The [flow](guide/glossary.md#flow) is always the same: report →
file → triage → claim → work → prove → close.

- **Filed first.** The agent writes the report down before anyone works on
  it: `naima new bugs "Figure 3 uses last year's data"` creates a folder for
  it under `naima-tracker/naima-data/bugs/`.
- **Routed by kind.** "This is broken" is a [bug](guide/glossary.md#bug),
  "this needs doing" is a [todo](guide/glossary.md#todo), "I'd like it to do
  X" is a [feature](guide/glossary.md#feature)
  ([reporting and triage](agents/reporting-and-triage.md)).
- **Triaged by an agent.** It rewrites the report in its own words as a clear
  description (what happens, what should happen, how to see it), notes what
  it checked, links duplicates (`naima link <new> duplicate-of <old>`) and
  sets the fields (`naima triage set <item> impact=high priority=now
  confidence=measured`). How long it will take (`effort`) is set only after
  someone has looked at the work, never guessed.

**Example (a paper).** A co-author says in chat "section 4 contradicts the
abstract". The agent files a bug, writes which sentence contradicts which,
links the earlier report of the same problem, and ranks it before the
submission gate.

**Today:** filing, routing, fields, links, boards (`naima board bugs`),
`naima summary`. Commands to rewrite a description and to add a dated
comment are [planned](planned.md#commands-for-every-action); today the agent
edits the item's page.

### Planning

Above single fixes sit the things that keep long work coherent:
[epics](guide/glossary.md#epic) that group features and todos,
[milestones](guide/glossary.md#milestone) (a gate with a date),
[requirements](guide/glossary.md#requirement) that say what must hold, and
[specifications](guide/glossary.md#specification) that say exactly how. Each
is meant to be an item, so a requirement is tracked and proven like a test,
not just implied by one.

**Example (a data analysis).** Epic: "Replicate the 2024 study". Features:
"load the new survey", "redo table 2". Requirement: "every number in table 2
comes from the raw data by a script". Milestone: "draft results by 15
November".

**Today:** features (`requested`, `planned`, `shipped`, `withdrawn`) and
todos are item types. Epics and milestones are
[planned first](planned.md#epics-and-milestones); requirements and
specifications [after them](planned.md#requirements-specifications-and-decisions).

### Gates and the queue

A [gate](guide/glossary.md#gate) is what a release waits on. The
[queue](guide/glossary.md#queue) is everything still blocking a gate, split
by whose hands it needs: an agent's, yours, or a build machine's.

**Example.** Gate `v1` holds three items. `naima gates v1 --check` fails
while any is open, so a release cannot slip through. `naima queue v1
--human` shows the one that needs you: "looks right on a phone (judgement)".

**Today:** gates declared in `naima-tracker/naima-data/naima.json`, waiting
on code or on proof; `naima gates`, `naima queue`, `naima queue --human`
([read the board, the queue and the gates](guide/read-the-board.md)). Gates
with a date and gates on metrics are [planned](planned.md#epics-and-milestones).

### Process management over the long run

The work outlives any one session and any one agent. Each session leaves a
note; each agent says what it is working on; each works in its own
[worktree](guide/glossary.md#worktree). A new agent next month picks up where
the last one stopped, from files, not from memory.

- **Session notes:** `naima pass "what changed, what is proven, what is
  left"` writes `naima-data/passes/<date>-<id>.md`.
- **Claim files:** `naima claim <item> --note "why"` writes
  `naima-data/claims/<id>.json`; `naima release <item>` removes it; `naima
  prune` finds [claim files](guide/glossary.md#claim-file) whose branch is gone.
- **Worktrees:** one per piece of work, on its own branch
  ([opening a worktree](agents/opening-a-worktree.md)).

**Example.** Two agents work at once, one on the analysis script, one on the
paper's figures. `naima claims` shows who holds what. Neither can overwrite
the other: they write in separate copies, and Naima never has two sessions
edit the same file.

**Today:** session notes, claim files, the worktree flows, a check that a
claim file names items that exist, and one naming scheme for worktrees and
branches — `naima open` makes the worktree, the branch and the claim in one
step, and a check fails a worktree off the scheme or holding work without a
claim. A working method that keeps going until only your items are left is
[planned](planned.md#the-non-stop-method).

### Decisions

What only you can decide is asked once, with a recommendation, one question
at a time, and recorded. A permission you gave stays given.

**Example.** You decide "the paper targets the journal, not the conference".
That is recorded with its reason; no agent asks it again, and a later agent
reads it before planning.

**Today:** the rules for asking are written
([asking the human](agents/asking-the-human.md): only for judgement, a
decision, a credential such as a password, or a physical act; a settled
permission stays settled), and work handed to you must say why
(`humanBecause`, checked by `naima check`). Decisions as items, so "never
asked twice" is checked rather than remembered, are
[planned](planned.md#requirements-specifications-and-decisions).

### Rules

The project's own [rules](guide/glossary.md#rule) are data: each is an item
with the rule and its reason, who it binds (agents, people, everyone) and how
strongly (`must` or `should`). Where a program can enforce one, it names the
[check](guide/glossary.md#check).

**Example.** Your working style becomes a rule: `naima new rules "Ask before
deleting" --set audience=agents --set strength=must`, with "what cannot be
undone is the owner's decision" as its reason. Every agent reads it at the
start: `naima rules --audience agents`.

**Today:** rules as items, `naima rules`, `naima guide` printing them first,
`enforcedBy` naming the check, `naima check` holding the tracker to its
rules like a test suite ([write a project rule](guide/write-a-project-rule.md),
[the rules every project holds to](guide/rules.md)).

### Evidence, proof and formal methods

Every [claim](guide/glossary.md#claim) carries
[evidence](guide/glossary.md#evidence), kept in the item's `attachments/`.
"Fixed" is not "done": an item closes only when something that proves it has
passed, and a [proof](guide/glossary.md#proof) counts only for what it was
run on.

- **Red, then green.** A test must fail on the old work and pass on the new;
  one that passes either way proves nothing.
- **Proofs expire.** If what a proof was about changes, the proof stops
  counting until it is run again.
- **Formal properties are tracked like tests.** A
  [model checker](guide/glossary.md#model-checker) is a tool that checks a
  design over every possible order of events and, when the design is wrong,
  prints the exact steps that break it. In Naima a
  [property](guide/glossary.md#property) is an item, proven only by running a
  [verifier](guide/glossary.md#verifier): `naima verify <property>` attaches
  the run; `naima set <property> status=holds` is refused.

**Example.** Two agents claim work at the same moment on two branches. Can
one claim file wipe out the other when they merge? Naima's design says no:
each claim is its own file. An mCRL2 model of this coordination protocol
(claim, release, merge) states the property "no claim is ever lost". mCRL2
is a toolset for modelling and verifying systems in which many things happen
at once; its tools check the property for every order of steps. The property
is an item, tracked like a test. If anyone edits the model, `naima check`
reports the property as no longer proven and `naima close` will not rely on
it until it is run again.

**Today:** evidence in `attachments/`, `naima close` refusing without a
passed proof, properties, `naima verify`, `naima verifiers`, expiry when the
model changes ([prove and close](guide/prove-and-close.md)). Only an example
verifier ships (`naima/src/plugins/verifier/adapters/example-regex.ts`), so
the mCRL2 example above is [planned](planned.md#model-checkers-and-the-strength-of-evidence),
as are a check for red-then-green and a written order of how strong each
kind of evidence is.

### Metrics (planned)

Numbers measured on every commit (each saved change): speed, quality, test
coverage, each compared with a baseline, shown as a trend, and usable as a
gate. **Example:** "the analysis must still run in under ten minutes",
measured on every commit, and a release waits if it gets slower. Today only
`naima triage` counts how many items have each field set
([planned](planned.md#metrics)).

### Structuring a project from the start (planned)

An epic of its own for the first decisions that decide whether work can
still grow in two years: which language or languages to use, splitting
everything into small independent parts, keeping logic separate from data.
**Example:** before the first script of an analysis, the agent proposes data
in plain files, one script per table, no number typed by hand into the
paper; you decide, and the choices become rules
([planned](planned.md#structuring-a-project-from-the-start)).

### Design, skills and a dashboard (planned)

Support for planning and checking what users see; items and flows that point
to a [skill](guide/glossary.md#skill) published on GitHub instead of copying
it; a visual page of the project's state
([planned](planned.md#design-skills-and-a-dashboard)).

### Commands for every action

Every action an agent takes on an item has a command, so each is recorded
the same way and can be checked. **Today:** `new`, `set`, `link`, `triage
set`, `claim`, `release`, `pass`, `verify`, `close`, `check` (`naima help`
lists them all; the [reference](reference/reference.md) documents each).
Editing an item's description and adding a dated comment are
[planned](planned.md#commands-for-every-action).

## The company and its roles

Each job refuses something, so no one marks their own homework. Who sorts,
who builds, who tests and who judges are different agents
([the coordinator and the workers](agents/coordinator-and-workers.md)).

| Job | Who | Refuses | Today |
|---|---|---|---|
| **Owner** | you | any machine work; is asked only for judgement, a decision, a credential or a physical act | exists |
| **Coordinator** — talks to you, starts workers, merges | agent | doing a worker's job; more than one question at a time | written practice |
| **Filer** — turns what was said into the right item | agent | inventing scope; deciding if something is proven | written practice |
| **Implementer** — does the work for one item (code, analysis, text) | agent | widening the task; touching the main branch | written practice |
| **Lead developer** — ranks the queue, runs the gates, merges | agent | merging without the gates; closing its own items | exists; "never close your own" is a check |
| **Tester** — performs the tests, writes down what happened | agent, or a person with a reason | fixing what it finds; testing what it wrote | written practice |
| **Evidence owner** — judges whether evidence proves the claim | agent | performing the test it judges | written practice |
| **Release manager** — proposes a release when the gates hold | agent | releasing on an open gate; deciding to release | [planned](planned.md#roles) |
| **Documentarian** — writes the docs with the feature | agent | marking a feature shipped without its pages | [planned](planned.md#roles); the rule is already a check |
| **Announcer** — release notes, changelog, site, announcements | agent | announcing anything not shipped and checked | [planned](planned.md#roles) |
| **Business** — options for licence, funding, sponsorship, adoption | agent proposes, you decide | committing the project to anything | [planned](planned.md#roles) |

"Written practice" means the job and its refusals are written in
[the pages for agents](agents/README.md) and agents follow them, but no
program stops a breach.

## Principles

- **Privacy.** Your chat with an agent is private. Nothing from it is copied
  into the repository unless you say so explicitly. A screenshot or file you
  shared becomes an attachment only after your explicit yes
  ([the rule](guide/rules.md#the-owners-chat-stays-private)).
- **Extensible forever, by data.** Everything beyond a small core is a
  [plugin](guide/glossary.md#plugin): item types, fields, checks, gates,
  verifiers ([add a plugin someone gave you](guide/add-a-plugin.md)).
  Extension is plain data, not class hierarchies. The core does not move; the
  rest is free to change.
- **Iterate, don't overthink.** The simplest design that works now, improved
  version by version
  ([design principles](https://github.com/vincenzoml/naima/blob/main/develop/requirements.md#design-principles)).
- **Plain language.** Every term is defined once, in the
  [glossary](guide/glossary.md), and reports to you say what changed and what
  is needed from you, nothing else.

## One example, start to finish

You type in chat: **"the export loses transparency"** (saved pictures get a
solid background). The real commands for the same path, with their output,
are in [the tutorial](guide/tutorial.md).

1. **Filed.** `naima new bugs "Export drops the alpha channel"` creates the
   item folder with `README.md`, `meta.json` and `attachments/`.
2. **Triaged by an agent.** It writes the description in its own words,
   checks for duplicates, and runs `naima triage set export-drops
   impact=high priority=now confidence=measured`.
3. **Claimed, in a worktree.** A worker agent runs `naima open export-drops
   --as worker --name export-alpha`: a worktree on the branch
   `worker/export-alpha`, with the claim written in it.
4. **Fixed, with a proof.** It fixes the exporter and writes the test as its
   own item: `naima new tests "Export keeps the alpha channel" --set
   runBy=agent` and `naima link export-keeps verifies export-drops`. The test
   fails on the old code and passes on the new.
5. **Evidence attached.** The test's output goes to the test's
   `attachments/run.txt`; `naima set export-keeps status=passed`.
6. **Gate and handover.** The gates run; `naima release export-drops` and
   `naima pass "..."` record the end of the session; the branch is merged
   with `git merge --ff-only`, which refuses rather than overwrite anything.
7. **Closed by someone else.** From the main branch, `naima close
   export-drops` moves it to `naima-data/closed/` with its proof. It refuses
   from the fixer's own branch, and refuses without a passed proof.

**The same, vibe-coded.** The AI edits the exporter and says "Fixed!".
Nothing is written down or run. The edit broke PDF export and no test
noticed. The next session, with no memory, brings the bug back. A parallel
session overwrites the same file. Weeks later you describe the bug again
from scratch, and nobody can say what happened.

## What exists today

Checked against the commands of this version (`naima help`, `naima types`).

- Items as folders (`README.md`, `meta.json`, `attachments/`) under
  `naima-tracker/naima-data/`; types bugs, todos, features, tests,
  properties, rules (`naima types`).
- Reporting and triage: `naima new`, `link`, `triage set`, `board`, `summary`.
- Fixed, proven and closed as three separate states; `naima close` refusing
  without proof or from the fixer's branch.
- Gates and the queue: `naima gates`, `naima gates <name> --check`, `naima
  queue --human`.
- Long-running work: claim files, session notes, worktree flows, `naima prune`.
- Rules as items: `naima rules`, `naima guide`, `naima check`.
- Properties and verifiers with expiring proofs; only an example verifier.
- The roles from Owner to Evidence owner, written in
  [the pages for agents](agents/README.md).
- Plugins for everything beyond the core; an installer that installs Deno.
- Naima tracks its own development the same way.

What does not exist yet is on one page: [planned](planned.md).
