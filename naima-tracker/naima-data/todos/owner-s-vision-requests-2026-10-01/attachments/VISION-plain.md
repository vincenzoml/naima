# Naima — what it is for, in plain words

## What Naima is

Naima is an enabling technology for people who are not technicians. It lets
experts in their own field, who are not remotely programmers, get excellent
results from AI agents. It works on anything that benefits from keeping
every version: software, a scientific data analysis, a paper written with
colleagues, a plan — or several of these at once in one project.

Used through an AI agent, Naima is a decision support system: a tool for
running long-lived work and making informed decisions about it. It is for
the owner, the person whose work it is. You say in plain words what you want
or what is wrong. Agents do the machine work: they write it down, plan it,
carry it out, check it and keep the proof.

**Why so much of this sounds like software.** Naima's methods come from
software engineering because building software is the most demanding case
of long-lived, shared, versioned work, and it is where the strongest tools
exist: tests, version control, mathematical checking of designs. The same
discipline applies to any versioned work, whether a data analysis, a paper
with colleagues or a plan: work written down, evidence for every claim,
decisions recorded, gates before anything goes out. So most examples below
are software, and today's built-in item types (bugs, tests, features) are
shaped for software. Packs of item types for other kinds of work are
planned.

**A quiet way to manage decisions.** When the agents can go ahead on their
own, they do, and you hear nothing. When something is yours to decide, Naima
helps you understand it in your own terms and your own words, not a
technician's. `naima queue --human` lists what is waiting for you, each item
with the reason it is yours.

**The silent company that runs for you.** Behind the conversation there is a
team of agents with separate jobs: engineering, testing, judging evidence,
releasing, documenting, announcing, even the business side. The agents do the
work; you only decide. The jobs are listed in their own section below.

**A first example: turning vibe coding into science.** Vibe coding means
asking an AI to build software and hoping it worked. With Naima, the same
request goes through industry-grade practices and tools, without you needing
to know them, so that what gets built is robust, maintainable and solid. A
domain expert who has never programmed can build serious software this way.

**An enabler for software engineering and formal methods.** Software
engineering is the discipline of building software that lasts: written
requirements, tests, reviews, releases. Formal methods are tools that check a
design mathematically. Both are usually out of reach for anyone who is not a
specialist. Naima makes agents use them by default, and records what they
did.

**What you need, and how it stays out of your way.** You need no knowledge
of git, code, Deno or Node (the programs Naima runs on), or professional
project management. You need an AI agent. The agent installs what is missing:
git, and Deno (the installer does it). Naima lives inside the project's git
repository, the folder in which git keeps every version of the work. It uses
one folder there, `naima-tracker/`, and changes nothing outside it. It needs
no server, no account and no internet connection. You never have to open one
of its files or learn one of its commands; the agents do that, and the
commands below are what they type. `naima` is short for
`deno run -A naima-tracker/naima/naima.ts`.

## Concepts

Each word is used only in this sense below. "Planned" means Naima does not
have it yet.

| Word | What it means | Everyday example |
|---|---|---|
| **Item** | One piece of the work written down as a folder: a bug, a todo, a feature, a test. | A card on a renovation board, kept as a folder. |
| **Flow** | A written procedure the agents follow, step by step, for one kind of work. | The checklist a pilot runs before take-off. |
| **Epic** (planned) | A large goal made of many features and todos. | "Renovate the kitchen." |
| **Feature** | Something the work should be able to do, from "requested" to "shipped". | "A dishwasher under the counter." |
| **Todo** | A piece of work that is not a defect: a task, a tidy-up. | "Order the tiles." |
| **Milestone** (planned) | A gate with a date. | "Kitchen usable by 1 March." |
| **Requirement** (planned) | Something the result must satisfy, stated so it can be checked. | "The counter holds 50 kg." |
| **Specification** (planned) | The precise description of how something must behave. | The plumber's drawing with every pipe size. |
| **Decision** (planned as an item) | A choice that is the owner's, recorded with its reasons. | "White tiles, not grey." |
| **Claim** | A statement that something is true, such as "this bug is fixed". On its own it proves nothing. | A plumber saying "the leak is fixed". |
| **Evidence** | What was actually seen, saved next to the claim: a command's output, a screenshot. | The photo of the dry floor under the sink. |
| **Proof** | A repeatable way to check a claim, written so someone else can do it: a test, or a property a tool can check. | "Run the tap for a minute; the floor must stay dry." |
| **Rule** | Something the project always holds to, with its reason. | "No job is paid until the owner has seen it work." |
| **Check** | A rule a program enforces, so nobody has to remember it. | A till that will not print the bill until the job is marked "seen working". |
| **Gate** | A condition a release waits on: a list of items that must be done first. | "We move in only when water and power are signed off." |
| **Role** | A job in the team, defined mainly by what it refuses to do. | The inspector who signs off wiring never installs it. |
| **Worktree** | A private copy of the project in which one agent works, so it cannot disturb anyone else. | A draft on your own desk, not on the shared one. |

## What Naima manages

### Reporting and issue management

**What it is.** Whatever you notice reaches the project, and nothing said is
lost. You can report in chat ("figure 3 looks wrong"), correct a report
later, or, if you are comfortable with files, write the item yourself. The
flow is always the same: report → file → triage → claim → work → prove →
close.

- **Filed first.** The agent writes the report down before anyone works on
  it: `naima new bugs "Figure 3 uses last year's data"` creates
  a folder for it under `naima-tracker/naima-data/bugs/`.
- **Routed by kind.** "This is broken" is a bug, "this needs doing" is a
  todo, "I'd like it to do X" is a feature (`naima/docs/agents/reporting-and-triage.md`).
- **Triaged by an agent.** It rewrites the report in its own words as a clear
  description (what happens, what should happen, how to see it), comments
  with what it checked, links duplicates (`naima link <new> duplicate-of
  <old>`) and sets the fields (`naima triage set <item> impact=high
  priority=now confidence=measured`). How long it will take (`effort`) is set
  only after someone has looked at the work, never guessed.

**Example (a paper).** A co-author says in chat "section 4 contradicts the
abstract". The agent files a bug, writes which sentence contradicts which,
links the earlier report of the same problem, and ranks it before the
submission gate.

**Today:** filing, routing, fields, links, boards (`naima board bugs`),
`naima summary`. **Planned:** commands for rewriting the description and for
a dated comment (today the agent edits the page by hand).

### Planning

**What it is.** Above single fixes sit the things that keep long work
coherent: epics that group features and todos, milestones (a gate with a
date), requirements that say what must hold, and specifications that say
exactly how. Each is an item, so a requirement is tracked and proven like a
test, not just implied by one.

**Example (a data analysis).** Epic: "Replicate the 2024 study". Features:
"load the new survey", "redo table 2". Requirement: "every number in table 2
comes from the raw data by a script". Milestone: "draft results by 15
November".

**Today:** features (`requested`, `planned`, `shipped`, `withdrawn`) and
todos are item types. **Restored first:** epics and milestones, in daily use
in the method Naima comes from and lost in translation. **Planned:**
requirements and specifications as items.

### Gates and the queue

**What it is.** A gate is what a release waits on. The queue is everything
still blocking a gate, split by whose hands it needs: an agent's, yours, or
a build machine's.

**Example.** Gate `v1` holds three items. `naima gates v1 --check` fails
while any is open, so a release cannot slip through. `naima queue v1
--human` shows the one that needs you: "looks right on a phone (judgement)".

**Today:** gates declared in `naima-tracker/naima-data/naima.json`, waiting
on code or on proof; `naima gates`, `naima queue`, `naima queue --human`.
**Planned:** gates with a date (milestones), gates on metrics.

### Process management over the long run

**What it is.** The work outlives any one session and any one agent. Each
session leaves a note; each agent says what it is working on; each works in
its own worktree. A new agent next month picks up where the last one
stopped, from files, not from memory.

- **Session notes:** `naima pass "what changed, what is proven, what is
  left"` writes `naima-data/passes/<date>-<id>.md`.
- **Claims:** `naima claim <item> --note "why"` writes
  `naima-data/claims/<id>.json`; `naima release <item>` removes it; `naima
  prune` finds claims whose branch is gone.
- **Worktrees:** one per piece of work, on its own branch
  (`naima/docs/agents/opening-a-worktree.md`).

**Example.** Two agents work at once, one on the analysis script, one on the
paper's figures. `naima summary` shows who holds what. Neither can overwrite
the other: they write in separate copies, and Naima never has two sessions
edit the same file.

**Today:** session notes, claims, the worktree flows, a check that a claim
names items that exist. **Planned:** a strict naming policy for worktrees and
branches, and a check that every worktree carries a claim; a running loop
that keeps working until only your items are left (today the coordinator
sets a timer).

### Decisions

**What it is.** What only you can decide is asked once, with a
recommendation, one question at a time, and recorded. A permission you gave
stays given.

**Example.** You decide "the paper targets the journal, not the conference".
That is recorded with its reason; no agent asks it again, and a later agent
reads it before planning.

**Today:** the rules for asking are written (`naima/docs/agents/asking-the-human.md`:
only for judgement, a decision, a credential such as a password, or a
physical act; a settled permission stays settled), and work handed to you
must say why (`humanBecause`, checked). **Planned:** decisions as items, so
"never asked twice" is checked, not remembered.

### Rules

**What it is.** The project's own rules are data: each is an item with the
rule and its reason, who it binds (agents, people, everyone) and how strongly
(`must` or `should`). Where a program can enforce one, it names the check.

**Example.** Your working style becomes a rule: `naima new rules "Ask before
deleting" --set audience=agents --set strength=must`, with "what cannot be
undone is the owner's decision" as its reason. Every agent reads it at the
start: `naima rules --audience agents`.

**Today:** rules as items, `naima rules`, `naima guide` printing them first,
`enforcedBy` naming the check, `naima check` holding the tracker to its
rules like a test suite (`naima/docs/guide/rules.md`).

### Evidence, proof and formal methods

**What it is.** Every claim carries evidence, kept in the item's
`attachments/`. "Fixed" is not "done": an item closes only when something
that proves it has passed, and a proof counts only for what it was run on.

- **Red, then green.** A test must fail on the old work and pass on the new;
  one that passes either way proves nothing.
- **Proofs expire.** If what a proof was about changes, the proof stops
  counting until it is run again.
- **Formal properties are tracked like tests.** A model checker is a tool
  that checks a design over every possible order of events and, when the
  design is wrong, prints the exact steps that break it. In Naima a property
  is an item, proven only by running a verifier: `naima verify <property>`
  attaches the run; `naima set status=holds` is refused.

**Example.** Two agents claim work at the same moment on two branches. Can
one claim wipe out the other when they merge? Naima's design says no: each
claim is its own file. An mCRL2 model of this coordination protocol (claim,
release, merge) states the property "no claim is ever lost". mCRL2 is a
toolset for modelling and verifying systems in which many things happen at
once; its tools check the property for every order of steps. The property is
an item, tracked like a test. If anyone edits the model, `naima check` reports the property as no
longer proven and `naima close` will not rely on it until it is run again.

**Today:** evidence in `attachments/`, `naima close` refusing without a
passed proof, properties, `naima verify`, `naima verifiers`, expiry when the
model changes. Only an example verifier ships
(`naima/src/plugins/verifier/adapters/example-regex.ts`). **Planned:** real
model checkers as verifiers (mCRL2 first; VoxLogicA, a tool for checking
properties of images, where relevant); the mCRL2 model of Naima's own claims as a property in its own tracker; a check for
red-then-green; a written order of how strong each kind of evidence is.

### Metrics (planned)

**What it is.** Numbers measured on every commit (each saved change):
speed, quality, test coverage. Each is compared with a baseline, shown as a
trend, and usable as a gate.

**Example.** "The analysis must still run in under ten minutes": measured on
every commit, plotted over time, and a release waits if it gets slower.

**Today:** only `naima triage`, which counts how many items have each field
set. Everything else is planned.

### Structuring a project from the start (planned)

**What it is.** An epic of its own for the first decisions that decide
whether work can still grow in two years: which language or languages to
use, splitting everything into small independent parts, keeping logic
separate from data.

**Example.** Before the first script of an analysis, the agent proposes:
data in plain files, one script per table, no number typed by hand into the
paper. You decide; the choices become rules.

### Design and skills (planned)

- **Designing what users see:** support for planning and checking a user
  interface.
- **Skills from GitHub:** an item or flow points to a skill (a packaged set
  of instructions for an agent) published on GitHub, instead of copying it.
- **A dashboard:** a visual page of the project's state, later.

### Commands for every action

**What it is.** Every action an agent takes on an item has a command, so
each is recorded the same way and can be checked.

**Today:** `new`, `set`, `link`, `triage set`, `claim`, `release`, `pass`,
`verify`, `close`, `check` (`naima help` lists them). **Planned:** editing an
item's description, and adding a dated comment.

## The company and its roles

Each job refuses something, so no one marks their own homework. Who sorts,
who builds, who tests and who judges are different agents
(`naima/docs/agents/coordinator-and-workers.md`).

| Job | Who | Refuses | Today |
|---|---|---|---|
| **Owner** | you | any machine work; is asked only for judgement, a decision, a credential or a physical act | exists |
| **Coordinator** — talks to you, starts workers, merges | agent | doing a worker's job; more than one question at a time | written practice |
| **Filer** — turns what was said into the right item | agent | inventing scope; deciding if something is proven | written practice |
| **Implementer** — does the work for one item (code, analysis, text) | agent | widening the task; touching the main branch | written practice |
| **Lead developer** — ranks the queue, runs the gates, merges | agent | merging without the gates; closing its own items | exists; "never close your own" is a check |
| **Tester** — performs the tests, writes down what happened | agent, or a person with a reason | fixing what it finds; testing what it wrote | written practice |
| **Evidence owner** — judges whether evidence proves the claim | agent | performing the test it judges | written practice |
| **Release manager** — proposes a release when the gates hold | agent | releasing on an open gate; deciding to release | planned |
| **Documentarian** — writes the docs with the feature | agent | marking a feature shipped without its pages | planned; the rule is already a check |
| **Announcer** — release notes, changelog, site, announcements | agent | announcing anything not shipped and checked | planned |
| **Business** — options for licence, funding, sponsorship, adoption | agent proposes, you decide | committing the project to anything | planned |

"Written practice" means the job and its refusals are written in the agent
docs and agents follow them, but no program stops a breach.

## Principles

- **Privacy.** Your chat with an agent is private. Nothing from it is copied
  into the repository unless you say so explicitly. A screenshot or file you
  shared becomes an attachment only after your explicit yes.
- **Extensible forever, by data.** Everything beyond a small core is a
  plugin: item types, fields, checks, gates, verifiers
  (`naima/docs/guide/add-a-plugin.md`). Extension is plain data, not class
  hierarchies. The core does not move; the rest is free to change.
- **Iterate, don't overthink.** The simplest design that works now, improved
  version by version (`naima/docs/purpose.md`, design principles).
- **Plain language.** Every term is defined once (`naima/docs/guide/glossary.md`),
  and reports to you say what changed and what is needed from you, nothing
  else.

## One example, start to finish

You type in chat: **"the export loses transparency"** (saved pictures get a
solid background). The real commands for the same path are in
`naima/docs/guide/tutorial.md`.

1. **Filed.** `naima new bugs "Export drops the alpha channel"` creates the
   item folder with `README.md`, `meta.json` and `attachments/`.
2. **Triaged by an agent.** It writes the description in its own words,
   checks for duplicates, and runs `naima triage set export-drops
   impact=high priority=now confidence=measured`.
3. **Claimed, in a worktree.** A worker agent runs `git worktree add -b
   worker/export-alpha ../worktrees/export-alpha`, then `naima claim
   export-drops`.
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

Checked against this repository.

- Items as folders (`README.md`, `meta.json`, `attachments/`) under
  `naima-tracker/naima-data/`; types bugs, todos, features, tests,
  properties, rules (`naima types`).
- Reporting and triage: `naima new`, `link`, `triage set`, `board`, `summary`.
- Fixed, proven and closed as three separate states; `naima close` refusing
  without proof or from the fixer's branch.
- Gates and the queue: `naima gates`, `naima gates <name> --check`, `naima
  queue --human`.
- Long-running work: claims, session notes, worktree flows, `naima prune`.
- Rules as items: `naima rules`, `naima guide`, `naima check`.
- Properties and verifiers with expiring proofs; only an example verifier.
- The roles from Owner to Evidence owner, written in `naima/docs/agents/`.
- Plugins for everything beyond the core; installer that installs Deno.
- Naima tracks its own development the same way.

## What is planned

- Epics and milestones: restored first — they are in daily use in the
  method Naima comes from and were lost in translation.
- Requirements, specifications and decisions as items.
- Packs of item types for work other than software.
- Commands to edit a description and add a dated comment.
- Worktree naming policy, and a check that every worktree has a claim.
- A running loop that stops only when the owner's items are all that is left.
- Real model checkers (mCRL2 first); the mCRL2 model of Naima's own claims as a property.
- A check for red-then-green tests; an order of strength of evidence.
- Metrics per commit, with baselines, trends and gates.
- An epic for structuring a project from the start.
- User interface design support; skills referenced from GitHub; a dashboard.
- Release manager, documentarian, announcer and business roles.

## Coverage of the owner's points

| Owner point | Section |
|---|---|
| 1. Enabling technology for non-coders | What Naima is |
| 2. Any versioned work, several at once | What Naima is |
| 3. Decision support, quiet decision management | What Naima is; Decisions |
| 4. The silent company, its roles | What Naima is; The company and its roles |
| 5. Vibe coding into science, one example | What Naima is |
| 6. Software engineering and formal methods enabler | What Naima is; Evidence, proof and formal methods |
| 7. No git, code, Deno or project management needed; one folder | What Naima is |
| 8. Flows, reporting, filing, triage | Reporting and issue management |
| 9. Epics, features, todos, milestones, requirements, specifications | Planning |
| 10. Gates and the queue | Gates and the queue |
| 11. Sessions, claims, worktrees and naming | Process management over the long run |
| 12. Decisions and settled permissions | Decisions |
| 13. Rules as data, rules that become checks | Rules |
| 14. Evidence, red-then-green, expiring proofs, formal properties | Evidence, proof and formal methods |
| 15. Metrics | Metrics (planned) |
| 16. Structuring a project from the start | Structuring a project from the start (planned) |
| 17. UI design, GitHub skills, dashboard | Design and skills (planned) |
| 18. A command for every action | Commands for every action |
| 19. Privacy | Principles |
| 20. Extensible, data-only, fixed core, iterate | Principles |
| 21. Plain language, concepts defined once | Concepts; Principles |
