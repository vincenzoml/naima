# File a feature

Someone wants the work — a program, an analysis, a document — to do something it does not do yet.

## Ask for it

```sh
naima new features "Export keeps the alpha channel of layered files"
```

A new feature starts as `requested`: asked for, no code. On its page,
`README.md` in the folder it printed, write what "done" means before anyone
starts:

- **the behaviour**: what it does, seen from outside;
- **the boundaries**: what it does not do;
- **how it is documented**: which page a person reads, and what an agent
  needs.

Then [triage](triage.md) it like any [item](glossary.md#item).

## Its life

| Status | Means |
|---|---|
| `requested` | asked for; no code exists |
| `planned` | agreed and scheduled |
| `shipped` | on the [trunk](glossary.md#trunk), with its documentation |
| `withdrawn` | decided against |

```sh
naima set export-keeps-alpha status=planned
```

A request that is reversed later is recorded as reversed — `withdrawn`, with
the reason on its page — never overwritten.

## When it ships

A feature is documented as part of its implementation, for people and for
agents ([the rule](rules.md#features-are-documented-as-part-of-their-implementation)).
When it reaches the trunk, mark it `shipped` and name the pages that document
it, each a path from the project root, optionally with `#heading`:

```sh
naima set export-keeps-alpha status=shipped docs=docs/export.md#alpha
```

`naima check` fails when a shipped feature names no page, or a page or
heading that does not exist (the check `features-documented`).

## Proving it

A shipped feature can be proven like a fix: a test item that `verifies` it
([prove and close](prove-and-close.md)).
