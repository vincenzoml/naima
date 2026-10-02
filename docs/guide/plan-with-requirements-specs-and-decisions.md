# Plan with requirements, specifications and decisions

Three kinds of [item](glossary.md#item) keep the reasons behind the work
written down, so nothing important lives only in somebody's memory or in the
title of a test:

| Kind | What it says | Everyday example |
|---|---|---|
| a [requirement](glossary.md#requirement) | something the result must satisfy | "the counter holds 50 kg" |
| a [specification](glossary.md#specification) | exactly how something must behave | the plumber's drawing, every pipe size on it |
| a [decision](glossary.md#decision) | a choice, or a permission, that is yours | "white tiles, not grey" |

You say them in plain words; an agent files them. Each command below is what
the agent types, so you can check what it did.

## Requirements: what must hold

A requirement is stated so it can be checked, and it counts as **met** only
when a test (or a [property](glossary.md#property)) that checks it has passed.
Until then it is *stated*.

```sh
naima new requirements "Every number in table 2 comes from the raw data by a script"
naima link features/redo-table-2 satisfies requirements/every-number-table-2-comes-from-raw
naima link tests/table-2-rebuilt-matches verifies requirements/every-number-table-2-comes-from-raw
```

The first link says which piece of work delivers it; the second says which
test proves it. To see every requirement, what delivers it and what proves it:

```sh
naima view requirements
```

```
✓ requirements/every-number-table-2-comes-from-raw  Every number in table 2 comes from the raw data by a script  [met] proven
    satisfied by: features/redo-table-2
    proven by:    tests/table-2-rebuilt-matches
```

`naima check` keeps it honest: it refuses a requirement marked met with no
test that passed, or with one that failed; it reminds you of one that is
proven but not yet marked met, and of one that nothing delivers or proves.

## Specifications: how it must behave, version by version

A specification is the precise description of a behaviour. It is kept in
numbered versions — `export-format-v1`, `export-format-v2` — and only one
version is **current**: the one the work follows.

```sh
naima new specs "Export format"                 # export-format-v1, a draft
naima set specs/export-format status=current    # agreed: work follows it
naima link features/csv-export specified-by specs/export-format
```

When the behaviour has to change, the specification changes **first**:

```sh
naima spec revise specs/export-format
```

This opens `export-format-v2` as a draft, with the page of version 1 to edit
and a link saying it replaces it. Once it is agreed, the new version becomes
current and the old one is marked superseded; the work is then built to the
new version, and checked against it before it closes. `naima spec` lists every
specification with its current version and the open work that follows it.
`naima check` refuses two current versions of one specification, and reminds
you of work still following an old version.

## Decisions: asked once, never again

When something is genuinely yours to decide, an agent asks you once. Your
answer is recorded as a decision: dated, your words restated, the reason, and
what would make the question worth asking again.

```sh
naima new decisions "The paper targets the journal, not the conference"
naima link decisions/paper-targets-journal-not-conference settles todos/choose-venue
```

Before asking you anything, an agent searches what you already decided:

```sh
naima decisions journal
```

```
decisions/paper-targets-journal-not-conference  The paper targets the journal, not the conference  (2026-10-01)
  settles todos/choose-venue
```

A permission you mean to keep — "you may always rerun the analysis without
asking" — is a decision with `standing=true`; the search marks it a *standing
permission*. If you change your mind, the new answer is a new decision that
supersedes the old one, which is kept as history: nothing is overwritten.
`naima check` points out an item still waiting for your decision when a
decision already answers it, so it is acted on instead of asked again.

How agents decide what to ask at all: [asking the human](../agents/asking-the-human.md).
