# Rules

The rules every project that uses Naima holds to, for people and
[agents](glossary.md#agent) alike. This is the only place they are written:
the [flows](glossary.md#flow), the skill and every other page link here instead of repeating
them.

Each rule is marked:

- **enforced by** a [check](glossary.md#check) of `naima check`, a
  [write hook](glossary.md#write-hook) or a command that refuses — Naima stops
  you when it is broken;
- **convention** — nothing stops you; the project keeps it by habit, and the
  linked page says how.

Every check, with how it decides: [reference](../reference/reference.md).
Rules that apply only to developing Naima itself are in Naima's own
`AGENTS.md`, not here; [a project's own rules](#a-projects-own-rules) are
data in its tracker.

## The tracker

### Change the tracker only through the CLI

Items are created, changed, linked and closed with `naima` commands, never by
editing `meta.json` by hand. An item's page, `README.md`, is written with
`naima describe` (the description) and `naima note` (a dated, attributed,
append-only note); a person may also write it as a file.
**Enforced by** the checks `readable`, `identity`, `fields` and `links`,
which fail on what a hand edit typically breaks; the rest is convention.

### Run `naima check` before every commit

**Convention**, kept by the project's own CI when it runs `naima check`.

### Write it down before fixing it

A defect, a task or a request becomes an [item](glossary.md#item) first,
then gets worked on. A fix with no trace is diagnosed from scratch next time.
**Convention**: [file a bug](file-a-bug.md).

### Triage what you touch

An item you open, report or fix leaves with [impact](glossary.md#impact),
[priority](glossary.md#priority) and [confidence](glossary.md#confidence) set.
**Convention**; `naima triage` shows coverage and `naima triage missing`
what lacks [effort](glossary.md#effort): [triage](triage.md).

### Effort is never guessed

Only someone who has looked at the work to be done sets `effort`. **Convention**: no
tool infers it (`naima triage derive` never touches it).

### Fixed, resolved and closed are three states

[Fixed](glossary.md#fixed) (the change exists), [resolved](glossary.md#resolved)
(fixed and proven) and [closed](glossary.md#closed) (resolved and archived)
are never confused or added into one number. **Enforced by** `naima close`,
which refuses anything not resolved, and the checks `closed-carries-proof`
(every archived item carries a passed [proof](glossary.md#proof)) and `proven-but-open` (a note:
an open item whose proof passed, ready to close).

### Every fix names the gesture that proves it

A fixed item is [verified by](glossary.md#verifies) a
[test item](glossary.md#test-item) or a [property](glossary.md#property).
**Enforced by** the check `fix-names-its-gesture`, as a note: it reports, and
never fails: [prove and close](prove-and-close.md).

### A proof is current, and evidence against it wins

An item whose verifying item [refutes](glossary.md#refutes) it, or whose
proof `naima check` reports as no longer current (a property run on a model
changed since), cannot be closed. **Enforced by** `naima close` and the check
`property-evidence`; a property becomes `holds` only through `naima verify`
(the write hook `holds-only-by-verify`).

### Evidence travels with the claim

"It works" without a number, a log line or an attachment is not a proof.
[Evidence](glossary.md#evidence) goes in the item's `attachments/`.
**Convention**, except for properties, whose runs `naima verify` attaches.

### A partial item says what is left

**Enforced by** the check `partial-says-what-is-left`: an item in status
`partial` carries at least one unticked `- [ ]` line on its page.

### Behaviour shipped without proof is marked

A [beta marker](glossary.md#beta-marker) in the code names the item whose
passing would prove it. **Enforced by** the check `beta-markers`: a marker
naming nothing, or outliving its proof, fails.

## People and agents

### Don't ask the human if you know the answer

A person is asked only for what is genuinely theirs: a judgement of how
something looks or feels, a decision reserved to the
[owner](glossary.md#owner), a credential, a physical act. **Convention**:
[asking the human](../agents/asking-the-human.md).

### Don't start implementing until the owner says so

A request is not a work order. First its item says what "done" is: for a
feature, its behaviour, its boundaries and how it is documented; for a defect,
its [triage](glossary.md#triage) fields and the gesture that proves the fix. Then implementation
waits for the owner's explicit go; until then the only work is writing and
refining that definition. A requirement that arrives while work is running
goes into the definition, never into the running work. **Convention**.

### Work handed to a person says why

An item whose proof needs a person (`runBy: human`) says which of the four
reasons it is in `humanBecause`. **Enforced by** the check `human-says-why`;
`naima queue --human` lists each with its reason
([run by](glossary.md#run-by), [human because](glossary.md#human-because)).

### Whoever fixes does not also close

A branch does not close its own items on the strength of its own tests:
someone else checks the proof, from the [trunk](glossary.md#trunk), after the
merge. **Enforced by** the write hook `no-closing-own-claims`: `naima close`
refuses an item the current branch [claims](glossary.md#claim-file), unless
`--force`, which is for the one who owns the evidence.

### The owner's chat stays private

The conversation between the [owner](glossary.md#owner) and an agent is
private. Nothing from it is copied into the repository verbatim: the agent
writes the report, the description or the note in its own words. The owner's
own words are quoted, and a file or screenshot the owner shared becomes an
attachment, only after the owner's explicit yes. **Convention**:
[reporting and triage](../agents/reporting-and-triage.md#3-what-a-report-carries).

### Git is the agent's job, done safely

The owner never has to learn git. Agents install it when it is missing,
start a repository when there is none, keep secrets and private data out of
it with a `.gitignore`, and save work in small commits; they never
force-push, never rewrite history, and never commit a secret.
**Convention**: [git, handled for the owner](../agents/git-for-the-owner.md).

## Branches and worktrees

### One worktree per piece of work

Each piece of work has its own [worktree](glossary.md#worktree) and its own
[branch](glossary.md#branch), and writes to that branch and nowhere else.
**Convention**: [work on several branches at once](several-branches.md),
[worktree isolation](../agents/worktree-isolation.md).

### Worktrees and branches are named by one scheme, and every worktree carries a claim

The branch is `<who>/<what>`, each part lowercase letters, digits, dots and
dashes; its worktree is the folder `<what>` of the worktrees directory
(`<main checkout>-worktrees` beside the main checkout, unless configured).
Every worktree carries a [claim file](glossary.md#claim-file). `naima open`
makes the three in one step. **Enforced by** the check `worktree-policy`: a
worktree outside the directory or misnamed, a branch off the scheme, and a
worktree whose branch has commits the trunk lacks with no claim (now, or
released in those commits) and no session note fail; a fresh worktree with
no claim yet is a note. Branches the scheme does not cover are listed under
the coordination plugin's `exempt` option.

### No shared mutable file

Two sessions never edit one file to register, announce or log something;
a collection is a directory of one file per session, named by a uuid.
**Convention** for the project's own files; Naima's claims and [session notes](glossary.md#session-note)
are built this way.

### A claim names real items

**Enforced by** the check `claims-resolve`.

### Nobody commits on the trunk while branches are being prepared

**Enforced by** the check `trunk-moved-while-preparing`, as a note: a branch
whose claim is marked `naima claim --preparing` is told every commit the
trunk took that it lacks, and which of them the trunk's reflog records as
committed on the trunk directly. The reflog is this clone's own: a commit
made in another clone and pulled arrives as a fast-forward and is not named.
[Worktree isolation](../agents/worktree-isolation.md#2-nobody-commits-on-the-trunk-while-branches-are-being-prepared).

### No branch is deleted with work only it holds

**Enforced by** `naima prune --branch`, which deletes a branch and its
worktree only when the trunk or an `archive/<branch>` tag holds its commits;
`--archive` makes the tag first. Before a bulk change of the tracker — many
items moved, closed or deleted at once — tag the commit it starts from,
`git tag checkpoint/<date>-<what>`. Plain `git branch -D` is not stopped:
[closing a worktree](../agents/closing-a-worktree.md#8-only-then-remove-the-worktree-and-the-branch).

### Every merge to the trunk is a fast-forward

`git merge --ff-only <branch>`; if it refuses, stop and resolve on the branch.
**Convention**, enforced by git only when the project configures it:
[closing a worktree](../agents/closing-a-worktree.md).

### Claims are released, and a session note written, before merging

**Convention**: [closing a worktree](../agents/closing-a-worktree.md).

## Naima itself

### Update deliberately, as one commit

The [lock](glossary.md#lock) moves only with `naima update`, as one
reviewable commit; at the start of a session, `naima update --check`.
**Enforced by** [alignment](glossary.md#alignment), which never pulls and
refuses a changed [source](glossary.md#source) until `naima update
--accept-source`: [update Naima](update-naima.md).

### A tracker never mixes formats

**Enforced by** the check `one-format`: after a teammate's update, merge the
trunk and run `naima update` ([update Naima](update-naima.md#on-a-branch-opened-before-the-update)).

### Third-party code runs only pinned

A plugin from outside Naima runs only from a pinned file hash or commit.
**Enforced by** the loader, which refuses a changed file:
[add a plugin someone gave you](add-a-plugin.md).

## Documentation

### Features are documented as part of their implementation

A feature is not done until its documentation is in the same change, and
"documented" means **both** for people and for agents: a page a person can
follow without reading the code, and what an agent needs to act on it. A
feature item in status `shipped` names its pages in `docs`.
**Enforced by** the checks of the `docs` plugin:

| Check | Fails when |
|---|---|
| `features-documented` | a shipped feature names no page in `docs`, or names a file or heading that does not exist |
| `links-resolve` | a relative link in any markdown file the project tracks points at nothing |
| `documented` | a loaded plugin's command, type, field, check or [gate](glossary.md#gate) carries no documentation in its manifest |
| `reference-current` | with the `docs` plugin's `reference` option set, the reference file differs from what `naima docs` generates |

How to set `docs` on a feature: [file a feature](file-a-feature.md#when-it-ships).

## A project's own rules

A project's own rules — the ones only it holds to — are not pages of Naima's
documentation: they are data in its own `naima-tracker/naima-data/`.
`naima rules` lists them, and `naima guide` shows those for agents first:
[write a project rule](write-a-project-rule.md),
[read the project's rules](../agents/read-the-project-rules.md).
