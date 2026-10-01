# Extending Naima: writing a plugin

For a programmer who wants Naima to do something of its own project's: a new
[item](glossary.md#item) type, a field, a check, a command, a way of proving
something. Using a [plugin](glossary.md#plugin) someone else wrote is a
different, shorter page: [add a plugin someone gave you](add-a-plugin.md).
Terms: [glossary](glossary.md).

Almost everything in Naima is a plugin — the eight that ship
([first-party](glossary.md#first-party-plugin): `trackers`, `coordination`,
`triage`, `gates`, `beta-markers`, `verifier`, `docs`, `rules`) are written the
same way a project's own would be. The small core only loads them and runs
what they declare. A worked example of using Naima for research rather than
software is at the end.

## What a plugin declares

A plugin is a module whose default export is a factory: given the project's
options and a small API object, it returns a **manifest** — what it adds and,
for each thing, its own documentation, so [the reference](../reference/reference.md)
can be generated from the code instead of written by hand and left to drift.
A plugin can add to any of several **extension points**: item types, statuses,
fields, relations, checks, views, gates, verifiers, commands, summary
sections, rank terms, data migrations — and a project can declare new points
of its own, the way the `verifier` plugin needed a wholly new concept (a
model-checker run) when it was added. Each point says what a contribution to
it looks like and how it is checked.

## Sharing a project's vocabulary

A plugin that reads a field, type or relation it does not itself own —
`gates` reading the `fixedOn` field that `trackers` declares, say — declares
that it `uses` it. Loading the project then fails, with a clear message,
rather than silently doing nothing, the moment that field is missing because
the owning plugin was switched off or replaced. Two plugins can also agree on
a role instead of a literal name — "the field that marks an item fixed",
whichever field actually fills it — so one does not have to know the other's
field names at all.

## Extending another plugin's types and fields

Two ways to extend what another plugin already declared, used together:

- **Traits.** A type can carry a tag, such as `fixable`, instead of a field
  listing every type it applies to by name. A field that applies "to every
  fixable type" keeps working as new types are added, and two plugins never
  collide by both naming the same type explicitly.
- **Additive `extends`.** A project, or another plugin, can add a new status
  to an existing type (a `blocked` status on bugs, say) or a new value to an
  existing field's list. It can only add: it can never redefine what a
  status already means, or move it between the open and done halves of its
  type's life cycle.

Nothing here is a class hierarchy — the owner's explicit preference is data,
not inheritance. A status can also declare flags next to the built-in
open/done one (`refutes: true`, for a status that actively defeats a claim
rather than merely failing to help it) and a map of which statuses it may
move to.

## Write-time hooks

Every write a plugin can make — creating an item, setting a field, linking
two items, moving or closing one — runs through hooks declared in plugin
load order: a `beforeWrite` hook can refuse the write outright, with a
message a person or an agent can act on; an `afterWrite` hook runs once it
has gone through. This is how, without changing the core, a plugin can stamp
a date automatically, reset a property to open when what it checks has
changed, or refuse a status set by hand that should only ever be set by a
verifier passing.

## Views

A [view](glossary.md#plugin) (`naima view <name>`) returns both its data and
a way to render it as text, so the same view can be printed, exported as
JSON, or folded into markdown without computing it twice. A check, a gate or
a view may do its work asynchronously — shell out to an external tool as
part of a check, say — the core places no restriction against it.

## Proof currency

A property or test that once passed does not stay proven forever: if what it
checks has changed — the property's statement, the verifier it runs, the
model it reads — the proof is stale and no longer counts.
[`naima close`](prove-and-close.md) itself runs every check before closing an
item and refuses when one reports a problem on what the item names as its
proof, so a stale proof cannot close anything even before a plugin declares
its own precise rule for when its evidence is current.

## Names

Every contribution any plugin declares gets a qualified id, `<plugin>/<name>`
(`gates/v1`, `trackers/fixedOn`). Data on disk — `meta.json`, `naima.json` —
keeps the short name for readability, and it resolves on its own as long as
only one plugin declares it project-wide. The moment a second plugin
declares the same short name, Naima refuses to load, naming both qualified
ids, until the project's `naima.json` says which is which with a `rename`
map.

## Configuring a plugin

Every plugin, first-party or not, is configured the same way, under
`plugins` in `naima.json`: its own `options`, `enabled: false` to switch it
off, `replacedBy` to swap in a fork or an alternative, and `checks` to weigh
its checks `off`, `note` or `problem` — [configuration](config.md) has the
full shape and the common cases are on
[configure the project](configure-the-project.md).

## Plugins from outside the program

A plugin does not have to live inside Naima's own program directory: a
project can point `plugins.<name>.source` at a file of its own (pinned by its
sha256) or at a git repository (pinned by a full commit), without forking
Naima — [add a plugin someone gave you](add-a-plugin.md) walks through both.
A plugin written this way declares the contract version it was written for,
so one written against an older Naima fails to load with a clear message
instead of running against an API it does not match; what it may import from
the core is a small, explicit surface, kept separate from everything the
core keeps for itself.

## Data migrations

Each plugin keeps its own data-format number next to the core's, in
`naima.json`. A plugin that needs to rename a field or move where it keeps
something contributes its own migration, run by `naima update` right after
the core's; moving one plugin's data forward never forces every other
plugin's format to change — [migrations](../reference/format.md#migrations)
has the core's own.

## Trusting the source

Every run realigns the program directory to the exact source and commit
`naima.json` names, and refuses rather than silently follow a change to
either — [every run aligns the program](install.md#every-run-aligns-the-program)
is the full rule. A verifier adapter that needs to run an external tool (a
model checker's pipeline, say) declares the programs it runs, so the
launcher can grant exactly those and nothing else.

## Two small, project-facing behaviours

Two things every project sees, not only a plugin author:

- **Slug uniqueness.** `naima new` checks the name it is about to give an
  item against every branch's unmerged work, not only its own, so two people
  working on separate branches do not give two different items the same
  folder name; the rare remaining collision falls back to the item's id.
- **Triage fallbacks.** An item with no [impact](glossary.md#impact) or
  [priority](glossary.md#priority) set yet ranks at the middle of the scale,
  not at the bottom or the top; one with no [effort](glossary.md#effort) set
  ranks at the worst case, since effort is never guessed
  ([triage](triage.md)).

## A worked example: adopting Naima for a data analysis

None of the above is specific to software. A research group replicating a
published study tracks it exactly like a codebase: `naima new todos "redo
table 2 from the raw survey"`, triaged, claimed by whoever does the work in
their own [worktree](glossary.md#worktree), and closed only once a test item
proves it — here, a script that recomputes the table and a note recording
that the new numbers match the paper's claim. Bugs, todos and features
already cover most of this ([what Naima is for](../purpose.md) has more
examples).

A plugin is only needed when the built-in types stop fitting — a group that
wants its own tracked kind, with its own field naming the command that
reproduces it. `pack-analyses` is a shipped, minimal example of exactly that
plugin, one type and nothing else:

```json
"plugins": { "pack-analyses": {} }
```

```sh
naima new analyses "Table 2, rebuilt from the raw survey" --set command="scripts/table2.sh"
naima new tests "Rerun scripts/table2.sh and diff against table 2"
naima link <the test> verifies <the analysis>
naima set <the test> status=passed      # the rerun matched
naima set <the analysis> status=confirmed
```

An `analyses` item is proven exactly like a requirement: `naima check` notes
one confirmed without a passing test, and one already proven that is still
`proposed`. Reading its source
([`naima/src/plugins/pack-analyses/index.ts`](https://github.com/vincenzoml/naima/blob/main/naima/src/plugins/pack-analyses/index.ts))
is the fastest way to see how little a non-software pack has to add: one
type, one field, and a check that reuses `verifies`/`verified-by` rather than
inventing its own proof machinery. A paper's sections and reviews are the
second worked example, for work with no command to rerun at all: see
[Writing a paper: sections and reviews](paper-sections-and-reviews.md).
Another kind of non-software work would be its own pack, built the same way.
