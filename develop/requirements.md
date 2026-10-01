# Requirements and design principles

What Naima requires of itself, and the principles behind its design, for
people changing Naima's code. What Naima is for, and whom it serves, is on
[the purpose page](../naima/docs/purpose.md); this page says what holds each
promise there.

## Requirements

Each requirement has a short name, what it means, and what holds it: the
code, check or test that fails when it is broken. Where nothing does yet, it
says so.

### Functional

**plain-files.** Every item is a directory of plain files in the repository:
`README.md` for prose, `meta.json` for fields, `attachments/` for evidence.
No database, no server. Held by: the [format](../naima/docs/reference/format.md#items) and its
[invariants](../naima/docs/reference/format.md#invariants), which `naima check` runs (readable
items, a `README.md` and a JSON `meta.json` in every item directory).

**permanent-ids.** An item's uuid never changes; its slug may. Links hold
ids, and only one direction of a link is stored, the inverse derived.
Held by: the core invariants of `naima check` (unique uuids, links naming an
existing item, [architecture](architecture.md#checks)).

**derived-views.** Boards, queues, gate states, urgency, claim tables and
summaries are computed when read and never written, so no stored copy can go
stale ([concepts](../naima/docs/guide/concepts.md#derived-never-stored)). Held by: the plugin
contract, in which a view or summary returns data and has no way to persist
it ([views and summaries](../naima/docs/reference/plugin-contract.md#views-and-summaries)). No check
looks for a stored board: not yet enforced beyond that.

**three-completion-states.** Fixed (the code exists), resolved (fixed and
proven by an item that `verifies` it and has passed) and closed (resolved and
archived with its proof) are three states, never added into one number
([concepts](../naima/docs/guide/concepts.md#fixed-resolved-closed)). Held by: the checks
`closed-carries-proof` (a closed item carries its proof) and
`proven-but-open`, `naima close` refusing anything not resolved, and
`test/lifecycle.test.ts`.

**proof-stays-current.** A proof counts only for what it was run on. A
property that held on a model since changed, on an included file since
changed, by another tool version, or with a different property, verifier or
options, is no longer current, and `naima close` refuses it.
Held by: the check `property-evidence`, the write hooks
`property-reopens-when-changed` (a changed property goes back to open) and
`holds-only-by-verify` (a property holds only with a run for what it is now),
and the tests in `test/plugins/verifier/verifier.test.ts` and `test/lifecycle.test.ts`.

**verifiers-are-evidence.** A formal-methods tool plugs in as a verifier; its
run is attached as evidence with the hash of the model it ran on, and
resolves items like a passed test ([the verifier
contract](../naima/docs/reference/plugin-contract.md#the-verifier-contract)). Held by:
`test/plugins/verifier/verifier.test.ts` and the check `property-evidence`.

**gates.** A release or a merge is a named condition backed by items; an item
joins a gate by carrying `gate`, and may be on several. Held by: the `gates`
plugin and its tests, `test/plugins/gates/gates.test.ts`; the check
`gated-proof-is-gated`.

**no-shared-mutable-file.** Parallel sessions never edit one file. State that
belongs to no single branch, claims and session notes, is one uuid-named file
per session on its own branch, recombined when read from every local branch
and every worktree's disk ([worktree
isolation](../naima/docs/agents/worktree-isolation.md#4-no-shared-mutable-file)). Held by:
the `coordination` plugin and `test/plugins/coordination/coordination.test.ts`,
and `test/core/git.test.ts` for reading across branches. That every merge to
the trunk is a fast-forward is a flow, not code: not enforced by Naima.

**checked-like-code.** The tracker has invariants, and `naima check` fails
when one breaks, the way a test suite fails when the code breaks. Held by:
`naima check` itself, run by `deno task verify` in this repository before every push.

**documented-always.** Every feature is documented as part of its
implementation ([the documentation rule](documentation.md)). Held by: the
checks `documented` (every contribution carries its documentation),
`features-documented` (a shipped feature names its page), `links-resolve`
(every relative link in tracked markdown resolves) and `reference-current`
(the generated reference matches the code).

**agent-rules-checked.** Where a rule for people and agents can be checked,
it is ([the rules](../naima/docs/guide/rules.md), each marked enforced or convention):
a person is asked only for what is theirs, a fix names the gesture that
proves it, a branch does not close what it claims on its own tests. Held by:
the checks `human-says-why`, `fix-names-its-gesture` (a note) and
`claims-resolve`, the write hook `no-closing-own-claims` and its check
counterpart `closed-not-claimed`. The rules of
[AGENTS.md](../AGENTS.md), the rules for working on Naima, that are judgement, such as when to ask the owner,
are not enforced.

### Non-functional

**no-dependencies.** The core imports only itself and the `node:` built-ins
that Deno, Node and Bun all provide. Nothing is installed. Held by:
`test/arch.test.ts` ("the core imports nothing outside itself but node
built-ins"), and `deno.json`, which has no imports.

**portable-runtime.** The same code runs on Deno, Node and Bun. Held by: the
tests, run on all three before every push (`deno task verify`, `node --test`,
`bun test`; [AGENTS.md](../AGENTS.md#before-pushing)).

**small-fixed-core.** The core names no item type, field, relation, gate,
verifier or plugin; everything above it is a plugin. Held by:
`test/arch.test.ts` ("the core names no plugin's type, field, relation or
plugin"), and the [dependency rule](architecture.md#the-dependency-rule).

**extensible.** A project, or anyone, extends Naima through plugins: types,
statuses, fields, relations, checks, commands, views, gates, verifiers,
migrations ([extension points](../naima/docs/reference/plugin-contract.md#extension-points)).
Plugins never import each other; they cooperate through the registry. Held
by: `test/arch.test.ts` (a plugin imports only the core's public API and its
own files), `test/extending.test.ts`, and `test/external.test.ts` for plugins
outside Naima.

**stable-contract.** A plugin says the contract version it is written for; a
newer one is refused rather than half run ([the contract
version](../naima/docs/reference/plugin-contract.md#the-contract-version)). Held by:
`test/external.test.ts`.

**offline.** No run touches the network except through git, and only
alignment and `naima update` ask git for it; a normal run never pulls. Held
by: the launcher granting no network permission
([the permissions](../naima/docs/guide/install.md#the-permissions), `naima/src/launcher.ts`), and
`test/distribution.test.ts` ("a normal run never pulls").

**contained.** Naima writes nothing in a project outside `naima-tracker/`
(except `.gitmodules` when carried as a submodule), runs only git and the
programs its verifiers declare, and hands the program only an allow-listed
environment. Held by: the launcher's permissions, and the tests in
`test/distribution.test.ts` and `test/launcher.test.ts`.

**reproducible.** Every clone, worktree, colleague and CI run the same Naima:
the one locked by commit in `naima.json`. Alignment never overwrites work and
refuses a commit it cannot reach ([every run aligns the
program](../naima/docs/guide/install.md#every-run-aligns-the-program)). Held by:
`test/distribution.test.ts` and `test/core/lock.test.ts`.

**runtime-only-distribution.** A project receives only what runs Naima: no
tests, no CI, no development agent rules, none of Naima's own tracker items
([the copy](../naima/docs/guide/install.md#the-copy)). Held by: the runtime
folder `naima/`, which a project's program is a copy of and nothing else, and
`test/runtime-folder.test.ts` and `test/site.test.ts`, which hold the copy to it.

**forward-migration.** The data has a format number; it moves only with a
migration, forward only and deterministic; newer data is refused and left
untouched ([migrations](../naima/docs/reference/format.md#migrations)). Held by:
`test/core/format.test.ts` and the check `one-format`.

**fork-friendly.** The format is the compatibility boundary: a fork that
reads and writes it works on the same data as every other
([the format](../naima/docs/reference/format.md), [modifying Naima](../naima/docs/guide/install.md#modifying-naima)).
Held by: the format's invariants in `naima check`, and
`test/distribution.test.ts` ("a fork source is honoured once accepted").

## Design principles

**The core does not move.** Like the pedal point in Coltrane's *Naima*, a
bass note held while the harmony changes above it, the core stays small and
still, and everything built on it is free to change. It serves
**extensible** and **fork-friendly**: a project extends Naima without
forking the core, and forks keep sharing the data. The rule is in
[architecture](architecture.md#the-dependency-rule).

**Plain files and git, nothing else.** Files can be read by every tool and
every agent, diffed, reviewed and versioned with the code. Git already
solves storage, history, branching and distribution; Naima adds no second
system to keep in step with it. It serves **plain-files**, **offline** and
**no-shared-mutable-file**.

**Derive, never store.** A stored copy of something computed is a second
truth that will diverge. Computing it when read costs little and removes the
question. It serves **derived-views**.

**A claim is not a proof.** "Fixed" is what someone says; "resolved" is what
evidence shows. Keeping the two apart, and checking the difference, is what
makes a board trustworthy. It serves **three-completion-states** and
**proof-stays-current**.

**Check what can be checked.** A rule written only in prose is forgotten,
most of all by an agent in a new session. Where a rule can be a check, it is
one. It serves **checked-like-code**, **documented-always** and
**agent-rules-checked**.

**Automatic first.** Every first-party plugin is loaded and every default is
inferred from the repository; `naima.json` holds only what cannot be
inferred ([the automatic principle](../naima/docs/guide/config.md#the-automatic-principle)).
A project that needs nothing else configures nothing.

**Extension is data, not inheritance.** No object-oriented modelling: no
classes to subclass, no type hierarchy. A type carries plain tags (such as
`fixable`), a field applies to the types that carry a tag, and an extension
adds statuses or values to another plugin's type or field but never
redefines one ([extending](../naima/docs/reference/plugin-contract.md#extending-another-plugins-types-and-fields)).
Plain data can be merged, checked and documented; a hierarchy has to be
understood. Held by: `test/extending.test.ts`. That the code has no classes of
its own is a practice, not a check: the only ones are `NaimaError`, which
extends `Error` as JavaScript requires, and the frozen collections of the
registry.

**The fixed on-disk layout is the boundary between forks.** Anything may
change except the files a project holds; that is what keeps every fork on the
same data. It serves **fork-friendly**.

**The installed program holds nothing but what runs Naima.** Test runners,
type-checkers and agent harnesses that walk a project's files would pick up
Naima's tests, CI or agent rules if they were there. So a project copies
only the runtime folder of a `main` commit, and Naima's own development stays
beside it. It serves
**runtime-only-distribution** and **contained**.

**A host's own material lives organised in its naima-data.** Everything a
project keeps about its own work, items, claims, notes, evidence, is in its
`naima-tracker/naima-data/`, in the layout the format fixes, never scattered
through the host or mixed into the program.

**Nothing moves without a reviewable commit.** Updating Naima, changing its
source, carrying it differently: each is an explicit commit in the project.
That is the protection the permissions cannot give against a malicious
update ([what this does not protect](../naima/docs/guide/install.md#the-permissions)).

**Don't overthink; iterate version by version.** Choose the simplest design
that fixes the problem at hand, ship it, and extend it in a later version
when a real need appears. The contract version and the migrations exist so
that a later step never breaks what an earlier one wrote.

**Agents are a first audience.** The tool is designed for agents as much as
for people: flows written as procedures, rules checked by the tracker, and a
skill that teaches an agent the tool ([the Naima skill](../naima/docs/agents/skill.md)). A
person's time is the most expensive resource in the project, so it is
spent only on what is genuinely theirs
([asking the human](../naima/docs/agents/asking-the-human.md)).

## Non-goals

- **Not a hosted service.** There is no server and no account. Naima runs in
  the repository, offline. A dashboard is
  [planned](../naima/docs/planned.md); it would read the same files.
- **Not a database.** The data is plain files under git; there is no query
  engine, index or store to keep in step.
- **Not time tracking or people management.** No timesheets, no resource
  planning, no estimation charts. Naima tracks the state of versioned work —
  software, a data analysis, a paper — and the evidence for it.
- **Not a CI system.** It runs checks and records evidence; building and
  deploying are left to the project's own pipeline.
- **Not a formal-methods tool.** It runs model checkers through plugins and
  records what they say; it does not prove anything itself.
- **Not a package with releases.** No binaries, no versions to install:
  a project runs one locked commit of Naima's source.
- **Not closed to change.** Changing Naima to fit a project is encouraged; a
  fork is a normal way to use it, not a failure of the design.
