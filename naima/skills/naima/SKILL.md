---
name: naima
description: Run a project with Naima — any versioned work (software, a data analysis, a paper) whose bugs, todos, features, tests, rules and proofs are kept as files under naima-tracker/, for an owner who only decides. Use when a repository has naima-tracker/, when asked to report, triage, claim, fix, verify or close an item, or when asked to start tracking a project with Naima.
---

# Naima

Naima runs any versioned work — software, a data analysis, a paper with
colleagues — for an owner who decides while agents do the machine work. Its
items are files in the repository, under one folder, `naima-tracker/`, and
its board is derived by a CLI, never edited by hand
([what Naima is for](../../docs/purpose.md)). This skill is a pointer: the
rules and the procedures live in Naima's own documentation, linked below,
and win wherever this page is shorter.

The owner need not know git, code or project management. You take all of it
on, and bring them only what is genuinely theirs. Their chat with you is
private: never copy it into the repository verbatim, and attach a file they
shared only after their explicit yes
([the rule](../../docs/guide/rules.md#the-owners-chat-stays-private)).

In this page, `naima` means, from the project's root:

```sh
deno run -A naima-tracker/naima/naima.ts
```

## 0. Have git and a repository

Run `git --version`; install git if it is missing. If the project folder is
not a repository, `git init`, and write a `.gitignore` that keeps secrets and
private data out before the first commit. Commit small, never force-push,
never rewrite history, never commit a secret
([git, handled for the owner](../../docs/agents/git-for-the-owner.md)).

## 1. Have Deno

Run `deno --version`. If it is missing, install it with its official
installer, once per machine: `curl -fsSL https://deno.land/install.sh | sh`
([installing](../../docs/guide/install.md#deno-once-per-machine)).

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
is ignored ([bootstrap a project](../../docs/guide/install.md#bootstrap-a-project)).

When a run refuses, it says why in one line and what to do: local changes in
the program, a commit the source does not have, data in another format.

## 3. Update at the start of a session

```sh
naima update --check
```

When it says the source's dist moved, run `naima update`, then `naima check`,
then commit `naima-tracker/` as one change. Updating is your job, not a
person's: [updating](../../docs/guide/install.md#updating).

## 4. Read the project's rules

```sh
naima rules --audience agents
```

The project's own rules for agents — how to work and report here — kept as
items of its tracker. Obey them for the whole session; `naima guide` prints
them first too ([read the project's rules](../../docs/agents/read-the-project-rules.md)).

Before asking the owner anything, run `naima decisions <words>`: a settled
decision answers it, and the owner's answer to a new question is recorded as
one ([asking the human](../../docs/agents/asking-the-human.md)).

## 5. Work by the rules and the flows

Read the rules before acting, then the flow that applies. They are plain
files in the clone; `naima guide` prints where:

- [the rules](../../docs/guide/rules.md): every rule a project holds to, each
  marked enforced by a check or kept by convention — read them; they are
  written there and nowhere else
- [for agents](../../docs/agents/README.md): how an agent learns a project, and
  the flows, with when each applies
- [concepts](../../docs/guide/concepts.md): items, links, fixed / resolved / closed
- [the format](../../docs/reference/format.md): every file and field
- [reference](../../docs/reference/reference.md): every command, type, status, field and gate
- [glossary](../../docs/guide/glossary.md): every term, defined once

`naima help` lists the commands of the Naima in use; `naima summary` says where
the project stands.
