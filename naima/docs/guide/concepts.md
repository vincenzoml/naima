# Concepts

The ideas behind every command, for anyone using Naima. How they are used
day to day is on [how the project runs](how-the-project-runs.md). Each term
is defined once in the [glossary](glossary.md); the rules built on these ideas are on
[the rules page](rules.md).

## Items

Every [item](glossary.md#item) — a bug, a todo, a feature, a test, a
property, a rule — is a directory under the tracker:

```
naima-tracker/naima-data/<type>/<slug>/README.md       the prose
naima-tracker/naima-data/<type>/<slug>/meta.json       the fields
naima-tracker/naima-data/<type>/<slug>/attachments/    the evidence
```

`meta.json` always holds `id` (a permanent uuid), `title` and `status`; the
rest are fields declared by plugins. The slug is a readable name made from
the title's words in whatever script they are written (Latin letters lose their
accents; Cyrillic, CJK and every other letter are kept), and may
change; the id never does, and links hold ids. A slug another local branch
already holds under the same type is not taken again
([across branches](../agents/worktree-isolation.md#item-slugs-across-branches)). On the command line an item is
named by its id, `type/slug`, its slug, or any fragment of a slug that matches
exactly one item.

Which types, statuses and fields exist depends on the loaded plugins:
[reference](../reference/reference.md). Each status is in the `open` or the `done`
category; a status may also `prove` — count as [evidence](glossary.md#evidence) for whatever the item
`verifies`.

## Links

A link is `{ "rel": "<relation>", "id": "<uuid>" }` in the item's `links`.
Only the direction written is stored; the inverse (`verifies` ↔ `verified-by`,
`blocks` ↔ `blocked-by`) is derived when read, so the two can never disagree.

## Fixed, resolved, closed

Three states that are not synonyms:

- **fixed** — the change exists (the code, the corrected table, the
  rewritten paragraph): `fixedOn` is set. Nothing is proven.
- **resolved** — fixed, and proven by an item that `verifies` it and whose
  status proves: a test that passed, a property that holds.
- **closed** — resolved, and moved to the archive by `naima close`, carrying
  its [proof](glossary.md#proof).

A status may instead **refute** — a failed test, a violated property: then
the item it verifies is not resolved whatever else proves it, and it blocks
every [gate](glossary.md#gate) the two are on. `naima close` also refuses a proof `naima check`
reports as no longer current.

"How many bugs are left" is the unfixed count (`naima bugs`); fixed-but-
unproven is a different number, and the two are never added.

## Evidence

Evidence travels with the claim, in the item's `attachments/`. A property
checked by a formal-methods tool is evidence exactly as a passed test is:
`naima verify` attaches the run and the hash of the model it ran on, and
`naima check` fails when the model, or the property, [verifier](glossary.md#verifier) or options it
was run with, has changed since.

Evidence is ranked, strongest first, and a test says which kind it carries in
its `evidenceKind` field:

| Rank | `evidenceKind` | The evidence |
|---|---|---|
| 1 | `owner-gesture` | the owner performed the gesture and saw the result |
| 2 | `observation` | a screenshot, a log line or a number, kept with the item |
| 3 | `live-read` | the live state, read by tooling: a query, an API call, the running program's own answer |
| 4 | `diff` | a before-and-after comparison: counts, sizes, outputs |
| 5 | `inspection` | "the code looks right" — which proves nothing |

**No number without its comparison**: a count, a timing or a size proves
something only beside the value it is compared with — before and after,
expected and seen.

A regression test — one that verifies a bug — proves the fix only if it was
seen failing on the code before the fix, then passing on the fix: **red, then
green**. Its `redSeen` field records the day it was seen red. `naima check`
notes a passed regression test with no `redSeen`, and a passed test whose
evidence is `inspection`.

A page can also outlive its answer. Two more notes find that: an open item's
unticked `- [ ]` clause naming a test that has since passed, and an agent's
test whose page excuses it because something was held
([prove and close](prove-and-close.md#3-perform-it-keep-the-evidence)).

## Derived, never stored

Boards, queues, gate states, urgency and summaries are computed when asked
and never written, so no stored copy can go stale. `naima check` holds the
whole tracker to its invariants, the way a test suite holds the code.

## Gates

A gate is a named condition — a release, a merge — backed by items: an item
joins a gate by carrying `gate: <name>`. How each gate decides is in the
[reference](../reference/reference.md#gates).

## Coordination across branches

State that belongs to no single branch — who is working on what, where each
session left off — is written as one file per session on that session's own
branch, and recombined when read from every local branch: the [trunk](glossary.md#trunk) and every
unmerged branch, each read from the disk of the [worktree](glossary.md#worktree) that stands on it,
uncommitted files included, or from its ref when none does. Remote-tracking
refs are not read. Two sessions never edit one file. The [flows](glossary.md#flow)
that go with it: [flows](../agents/README.md).
