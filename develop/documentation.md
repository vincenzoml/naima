# The documentation rule

The rule, for every project that uses Naima, is on the rules page:
[features are documented as part of their implementation](../naima/docs/guide/rules.md#features-are-documented-as-part-of-their-implementation),
for people and for agents. This page says how Naima's own repository keeps
it, and how `naima check` holds it in any project.

## Where a feature of Naima is documented

A feature of Naima is documented in the same change that implements it, in
three places, each for its reader:

| For | Where | What it says |
|---|---|---|
| people, who never read the code | [`docs/guide/`](../naima/docs/guide/README.md) | the task it serves, step by step, on the how-to page for that task (a new one when no page fits), its terms in the [glossary](../naima/docs/guide/glossary.md), and its rule on the [rules page](../naima/docs/guide/rules.md) when it adds or enforces one |
| agents | [`docs/agents/`](../naima/docs/agents/README.md) and the [skill](../naima/skills/naima/SKILL.md) | what an agent must do differently: the flow that changes, or a pointer the skill needs; never a copy of a rule |
| everyone looking something up | the [reference](../naima/docs/reference/reference.md), generated | every command, option, type, status, field, check and gate, from the manifests, regenerated with `deno task docs` |

The feature's item names those pages in `docs` when it ships.

## How `naima check` holds it

In any project, in three places; the `docs` plugin is always loaded.

### 1. The manifests

Every contribution of every loaded plugin carries its documentation in the
manifest that implements it, and the `documented` check fails on one that
does not:

| Contribution | Must carry |
|---|---|
| plugin | `says`; each of its `options` a `says` |
| command | `says`, `usage`, at least one entry in `examples`, and an `options` entry for every `--flag` its usage names (and none that it does not); `enforces` is optional for any plugin (a note when missing) and held for every first-party command by test/plugins/docs/policy-map.test.ts |
| item type, status | `says` |
| field | `says`; for an enum, a meaning for every value |
| relation, check, view, verifier | `says` |
| gate | `says` (what it is for) and `decides` (how it decides) |

`naima docs` prints the reference generated from those manifests;
`naima docs --write <file>` writes it, and `naima docs --check <file>` fails
when the file differs from what the code generates, so the reference cannot
drift. In this repository the working tree runs that check (see [Naima tracking itself](bootstrap.md#why-the-reference-is-checked-by-the-working-tree)),
and the generated file is [reference.md](../naima/docs/reference/reference.md).

### 2. The tracker

An item of a feature type (`features` by default) in a documented status
(`shipped` by default) names its documentation in `docs`:

```sh
naima set export-keeps-alpha status=shipped docs=docs/export.md#alpha
```

Each entry is a path from the project root, optionally `#heading`. The
`features-documented` check fails when a shipped feature names nothing, or
when a named file or heading does not exist.

### 3. The prose

The `links-resolve` check follows every relative link in every markdown file
git tracks (or would track), and fails on any that does not resolve —
to a file, and to a heading when it names one. It is how a project knows that
the flows its agent instructions name exist.

## Always on

Nothing switches it on: the `docs` plugin is loaded in every project and
infers what to check from the repository ([the automatic principle](../naima/docs/guide/config.md#the-automatic-principle)).
Every option and its default: [reference](../naima/docs/reference/reference.md#docs).
