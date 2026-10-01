---
name: naima
description: Work in a project tracked with Naima — bugs, todos, features, tests and their proofs kept as files under naima-tracker/. Use when a repository has naima-tracker/, when asked to report, triage, claim, fix, verify or close an item, or when asked to start tracking a repository with Naima.
---

# Naima

Naima is a project tracker whose items are files in the repository, under one
folder, `naima-tracker/`, and whose board is derived by a CLI, never edited by
hand. This skill is a pointer: the rules and the procedures live in Naima's
own documentation, linked below, and win wherever this page is shorter.

In this page, `naima` means, from the project's root:

```sh
deno run -A naima-tracker/naima/naima.ts
```

## 1. Have Deno

Run `deno --version`. If it is missing, install it with its official
installer, once per machine: `curl -fsSL https://deno.land/install.sh | sh`
([installing](../../docs/install.md#deno-once-per-machine)).

## 2. Have a project

When the repository has `naima-tracker/naima-data/naima.json` but no
`naima-tracker/naima/` (a fresh clone, a new worktree), clone the `source`
that `naima.json` names into `naima-tracker/naima/` — or run the launcher of
any Naima at hand, such as the main worktree's, from inside the project. The
run aligns the program to the locked commit by itself.

When there is none and the work is to be tracked here:

```sh
git clone --branch dist https://github.com/vincenzoml/naima.git naima-tracker/naima
naima init
```

`init` writes `naima-tracker/` and touches nothing else. Commit
`naima-tracker/` with the work; git never shows `naima-tracker/naima/`, which
is ignored ([bootstrap a project](../../docs/install.md#bootstrap-a-project)).

When a run refuses, it says why in one line and what to do: local changes in
the program, a commit the source does not have, data in another format.

## 3. Update at the start of a session

```sh
naima update --check
```

When it says the source's dist moved, run `naima update`, then `naima check`,
then commit `naima-tracker/` as one change. Updating is your job, not a
person's: [updating](../../docs/install.md#updating).

## 4. Read the project's rules

```sh
naima rules --audience agents
```

The project's own rules for agents — how to work and report here — kept as
items of its tracker. Obey them for the whole session; `naima guide` prints
them first too ([rules as data](../../docs/rules-as-data.md)).

## 5. Work by the flows

Every change to the tracker goes through the CLI (`naima new`, `set`, `link`,
`claim`, `close`); `naima check` must pass before a commit. What to do, and
when, is in the flows — read the one that applies before acting. They are
plain files in the clone; `naima guide` prints where:

- [the flows, and when each applies](../../docs/flows/README.md)
- [concepts](../../docs/concepts.md): items, links, fixed / resolved / closed
- [the format](../../docs/format.md): every file and field
- [reference](../../docs/reference.md): every command, type, status, field and gate

`naima help` lists the commands of the Naima in use; `naima summary` says where
the project stands.
