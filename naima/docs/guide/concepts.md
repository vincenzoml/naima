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
category; a status may also `prove` — count as evidence for whatever the item
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
  its proof.

A status may instead **refute** — a failed test, a violated property: then
the item it verifies is not resolved whatever else proves it, and it blocks
every gate the two are on. `naima close` also refuses a proof `naima check`
reports as no longer current.

"How many bugs are left" is the unfixed count (`naima bugs`); fixed-but-
unproven is a different number, and the two are never added.

## Evidence

Evidence travels with the claim, in the item's `attachments/`. A property
checked by a formal-methods tool is evidence exactly as a passed test is:
`naima verify` attaches the run and the hash of the model it ran on, and
`naima check` fails when the model, or the property, verifier or options it
was run with, has changed since.

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
branch, and recombined when read from every local branch: the trunk and every
unmerged branch, each read from the disk of the worktree that stands on it,
uncommitted files included, or from its ref when none does. Remote-tracking
refs are not read. Two sessions never edit one file. The flows
that go with it: [flows](../agents/README.md).
