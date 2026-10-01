# The Naima skill

Naima ships an agent skill, [`skills/naima/SKILL.md`](../../skills/naima/SKILL.md),
in the format agent tools load: a directory named after the skill holding a
`SKILL.md` whose front matter gives its `name` and a `description` that says
when to use it.

## What it teaches

- **Bootstrap.** In a project without `naima-tracker/`: install Deno if it is
  missing, with its official installer, clone Naima into
  `naima-tracker/naima/`, and run `naima init`
  ([bootstrap a project](../guide/install.md#bootstrap-a-project)). In a project with
  one, every run aligns the program itself.
- **Update at the start of a session.** `naima update --check`; when the
  source's dist has moved, `naima update`, the checks, and one commit
  ([updating](../guide/install.md#updating)). Running it is the agent's job.
- **Work by the rules and the flows.** Read [the rules](../guide/rules.md),
  then the [flow](README.md#the-flows) that applies.
- **Read the corpus as files.** The flows, the rules, the format and the docs
  are plain markdown in the clone; `naima guide` prints where they are.

It is a thin pointer, never a second copy: the rules are on
[the rules page](../guide/rules.md), the procedures in the [flows](README.md#the-flows),
the ideas in [concepts](../guide/concepts.md), the files in
[the format](../reference/format.md), the commands in the
[reference](../reference/reference.md), and the skill links them. Its links are
checked by `naima check` like every other markdown file in this repository.

## Loading it

The skill ships in the clone, so it is always the one of the Naima the
project runs. Point the agent tool at it rather than copying the file, so its
links keep resolving. For Claude Code, from the project:

```sh
mkdir -p .claude/skills && ln -s ../../naima-tracker/naima/skills/naima .claude/skills/naima
```

That link is the project's own choice, outside `naima-tracker/`: Naima never
writes it. Before the first clone exists, give the agent this page's bootstrap
instead.
