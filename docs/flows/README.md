# Flows for people and AI agents

The written procedures for working on a project that Naima tracks, when some
or all of the work is done by agents. They are general: any project that
adopts Naima can adopt them, and this repository follows them itself.

| Flow | When |
|---|---|
| [Asking the human](asking-the-human.md) | before any question to the owner, and whenever work is handed to a person |
| [Worktree isolation](worktree-isolation.md) | always: the requirement every other flow obeys |
| [The coordinator and the workers](coordinator-and-workers.md) | how a session is staffed |
| [Opening a worktree](opening-a-worktree.md) | starting a piece of work |
| [Closing a worktree](closing-a-worktree.md) | before a branch is merged |
| [Reporting and triage](reporting-and-triage.md) | when something is said, seen or found |

Two words used throughout. The **owner** is the person the project answers
to: the one who decides. The **trunk** is the branch releases come from,
usually `main`.

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
naima-tracker/naima/naima.ts` ([installing](../install.md)). In this
repository it is `deno task naima`.

## Enforced, not only written

Where a rule can be checked, Naima checks it:

| Rule | Enforced by |
|---|---|
| a person is asked only for what is theirs | `human-says-why`: an item with `runBy: human` says why in `humanBecause` |
| every fix names the gesture that proves it | `fix-names-its-gesture` (a note) |
| closed means proven | `closed-carries-proof`, and `naima close` refuses anything not resolved |
| a claim names real items | `claims-resolve` |
| a feature is documented as part of its implementation | the [`docs` plugin](../documentation.md) |
| the flows an instruction names exist | `links-resolve`, over the markdown the `docs` plugin is given |

Full list of checks: [reference](../reference.md).
