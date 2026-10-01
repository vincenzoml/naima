# Structuring a project from the start

Before the first line of a new project, a few choices decide whether it can
still grow in two years: which language or languages, splitting the work
into small independent parts, keeping settings and data out of the code. Made
without thinking, each is cheap to change today and expensive to change
later. This is the checklist a new project runs through at its first commit,
each choice recorded once as a [decision](glossary.md#decision) so nobody
re-argues it.

## The checklist

Group the choices as an [epic](glossary.md#epic), so their progress is read
in one place:

```sh
naima new epics "Structuring the project"
```

Then, for each choice below: raise it, let the owner answer, and record the
answer as a decision before any code follows from it.

1. **Which language or languages.** One language is simplest to review and
   test; more than one is sometimes right (a script language for data, a
   systems language for performance), but it is a choice, not a drift.
2. **Small, independently testable parts.** Split the work so that each part
   can be built, tested and understood on its own, before anything is wired
   together. A part that cannot be tested alone is a sign the split is in
   the wrong place.
3. **Settings and data out of the code.** Configuration and data live in
   plain files the code reads, never typed into the source by hand: a
   number in a paper, a threshold in an analysis, a price in a product — each
   traceable to the file it came from, not to a line someone once edited.

## Recording each choice

```sh
naima new decisions "One language: TypeScript, for the whole project"
naima epic add structuring-the-project decisions/one-language-typescript-for-whole-project
```

A decision raised this way is searched before it is ever asked again
([decisions](plan-with-requirements-specs-and-decisions.md#decisions-asked-once-never-again)).
Once every choice has a decision, the epic is done:

```sh
naima epic structuring-the-project
```

```text
epics/structuring-the-project  Structuring the project  [done]  3 of 3 closed
```

## Today, and what is planned

Today, an agent proposes these choices in chat at the start of a new
project, and raises each as a decision when the owner answers; this page is
the checklist it (or a person, directly) follows by hand. Having the agent
run the checklist itself, unprompted, at a project's first commit, is
[planned](../planned.md#structuring-a-project-from-the-start).
