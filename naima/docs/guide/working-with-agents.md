# Working with AI agents

Naima is built for projects where [agents](glossary.md#agent) do the machine
work and you, the [owner](glossary.md#owner), decide. This page is for you:
how to get an agent going, what to ask of it, and what it will ask of you.
You need no knowledge of git, code or project management; how the work moves
is on [how the project runs](how-the-project-runs.md). What the agent itself reads is in
[the pages for agents](../agents/README.md).

## Get an agent going

**On a project without Naima**, give the agent the site's instructions —
"install Naima in this repository, following
https://vincenzoml.github.io/naima/llms.txt" — and it runs the installer
itself. It installs git and Deno if they are missing, starts a repository if
the folder has none ([git, handled for you](../agents/git-for-the-owner.md)),
and adds one line to the project's agent instruction file (`AGENTS.md`,
`CLAUDE.md` or the one your agent reads) so every later agent finds Naima.

**On a project with Naima**, point the agent's tool at the
[skill](glossary.md#skill), which ships inside the program directory. For
Claude Code, once, from the project's root:

```sh
mkdir -p .claude/skills && ln -s ../../naima-tracker/naima/skills/naima .claude/skills/naima
```

Other tools: tell the agent to read `naima-tracker/naima/skills/naima/SKILL.md`
first. The skill teaches it to update Naima at the start of a session, to
change the tracker only through the commands, and to follow the
[flows](glossary.md#flow) and [the rules](rules.md).

## What to ask of an agent

Ask in plain words; the agent turns them into [items](glossary.md#item) and commands.

| You say | The agent does |
|---|---|
| "This is broken: …" | files a bug in its own words, then [triages](glossary.md#triage) it ([file a bug](file-a-bug.md)) |
| "I'd like it to …" | files a feature, `requested`, and writes what done means for you to confirm ([file a feature](file-a-feature.md)) |
| "Where are we?" | `naima summary`, and tells you the one thing you need to decide |
| "Fix the next thing" | takes the most urgent open item, in its own [worktree](glossary.md#worktree), claims it, fixes it, writes the test that proves it |
| "What do you need from me?" | `naima queue --human`: the items only you can do, each with why |
| "Close what is proven" | closes, from the [trunk](glossary.md#trunk), what someone other than the fixer has checked |

Two things worth knowing:

- **Say what "done" is before work starts.** A request is not a work order:
  an agent writes the definition on the item and waits for your go.
- **A fix the agent made is not proven by the agent's own tests.** Someone
  else checks the [proof](glossary.md#proof) before the item closes
  ([the rule](rules.md#whoever-fixes-does-not-also-close)).

## What an agent will ask you

Only what is genuinely yours, and one question at a time
([the rule](rules.md#dont-ask-the-human-if-you-know-the-answer)). Each
question says which of four reasons it is:

| Reason | Example |
|---|---|
| `judgement` | "Which of these two colours reads better on the dark theme?" |
| `decision` | "Ship the export change in this release, or the next?" |
| `credential` | "Sign in to the store account so I can upload the build." |
| `physical` | "Plug the device in and press the button." |

A good question arrives with the answer the agent would give, so you can reply
in one word. If an agent asks you something it could have found out — what a
command prints, whether a test passes — say so: that is a defect in how it
works.

## Work handed to you

Items whose proof needs a person carry `runBy: human` and say why:

```sh
naima queue --human
```

For each: read its page, do what it says, put what you saw in its
`attachments/` (`naima attach <item> <file> --own`), and set the result (`naima set <item> status=passed`, or
`failed`). Or ask the agent to record it for you, telling it what you saw.

## Your chat stays private

What you say to an agent stays between you. It writes reports, descriptions
and notes in its own words; it copies your words, or attaches a file or
screenshot you shared, only after you say yes
([the rule](rules.md#the-owners-chat-stays-private)).

## Several agents at once

Usually one agent talks to you (the [coordinator](glossary.md#coordinator))
and hands the work to others ([workers](glossary.md#worker)), each in its own
worktree. You talk only to the coordinator. How it is staffed:
[the coordinator and the workers](../agents/coordinator-and-workers.md).

## Reading what agents did

- `naima summary` — where things stand, including the last
  [session notes](glossary.md#session-note).
- `naima pass --list` — the newest session notes in full.
- `git log` — every change, with its reason in the commit message.
