# For agents

Pages for an AI agent working on a project that Naima tracks. A person
using Naima reads [the guide](../guide/README.md) instead; what a person
should know about working with agents is
[there too](../guide/working-with-agents.md).

**What you are here.** Part of a quiet team that does the machine work for an
[owner](../guide/glossary.md#owner) who only decides
([what Naima is for](../purpose.md)). The owner may be a researcher, a writer
or a domain expert who has never programmed, and does not need to know git,
code or project management. You apply the practice — items, tests, proofs,
gates, small commits, a formal check where a verifier exists — without asking them to
learn it, and you bring them only what is genuinely theirs.

## How an agent learns a project

1. **Load the skill**, [`skills/naima/SKILL.md`](../../skills/naima/SKILL.md)
   in the program directory: it says how to install or align Naima, to update
   at the start of a session, and where everything else is
   ([the Naima skill](skill.md)).
2. **Read [the rules](../guide/rules.md)**: the rules every project holds to,
   each marked checked by Naima or kept by convention. They are written there
   and nowhere else; the flows below apply them.
3. **Read the project's own rules**: `naima rules --audience agents`. They
   are data in its `naima-tracker/naima-data/`
   ([read the project's rules](read-the-project-rules.md)).
4. **See where the project stands**: `naima summary`, `naima queue`,
   `naima claims` ([read the board](../guide/read-the-board.md)).
5. **Before acting, read the flow that applies**, below.

Everything is plain markdown in the program directory, the documentation of
the exact Naima the project runs: `naima guide` prints where. `naima help`
lists the commands of that Naima, and the [reference](../reference/reference.md)
documents each. A term not defined on a page is in the
[glossary](../guide/glossary.md).

## The flows

The written procedures for working on a project when some or all of the work
is done by agents. They are general: any project that adopts Naima can follow
them, and Naima's own repository does.

| Flow | When |
|---|---|
| [Asking the human](asking-the-human.md) | before any question to the owner, and whenever work is handed to a person |
| [Git, handled for the owner](git-for-the-owner.md) | always: installing git, starting a repository, the `.gitignore`, committing without ever losing work |
| [Worktree isolation](worktree-isolation.md) | always: the requirement every other flow obeys |
| [The coordinator and the workers](coordinator-and-workers.md) | how a session is staffed |
| [Opening a worktree](opening-a-worktree.md) | starting a piece of work |
| [Closing a worktree](closing-a-worktree.md) | before a branch is merged |
| [Reporting and triage](reporting-and-triage.md) | when something is said, seen or found |

Whatever the flow, the owner's chat is private: nothing from it goes into
the repository verbatim, and a file the owner shared becomes an attachment
only with their explicit yes
([the rule](../guide/rules.md#the-owners-chat-stays-private)). A way of
working that keeps going until only the owner's work is left is
[planned](../planned.md#the-non-stop-method).

Two words used throughout: the [owner](../guide/glossary.md#owner), the person
the project answers to, and the [trunk](../guide/glossary.md#trunk), the
branch releases come from.

## As agent commands

[`skills/naima/commands/flow/`](../../skills/naima/commands/flow/) holds one
command per flow, for agent harnesses that read commands from the repository
(Claude Code reads `.claude/commands/flow/` as `/flow:<name>`). They ship with
the skill, outside any `.claude/` directory, so a harness never loads them from
a project's `naima-tracker/naima/` unasked; Naima's own repository links its
`.claude/commands/flow` to them. Each command is a checklist that points at its
page here; where the two disagree, the page wins. To adopt them in another
project, copy the directory into its `.claude/commands/flow/`, and the pages if
the project does not depend on Naima's docs.

In the commands, `naima` is the CLI: `deno run -A
naima-tracker/naima/naima.ts` ([installing](../guide/install.md)). In Naima's
own repository it is `deno task naima`.
