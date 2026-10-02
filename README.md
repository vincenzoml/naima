# Naima

**Website: [vincenzoml.github.io/naima](https://vincenzoml.github.io/naima/)**

Naima is a silent software house of AI agents that turns vibe coding into an
exact science — born for software, it manages any project.

## Install

In the root of a git repository, one line:

```sh
curl -fsSL https://vincenzoml.github.io/naima/install.sh | sh     # macOS, Linux
irm https://vincenzoml.github.io/naima/install.ps1 | iex          # Windows PowerShell
```

Or ask your agent:

> Please install https://github.com/vincenzoml/naima in this repository.

The installer sets up [Deno](https://deno.com) when it is missing, clones
Naima into `naima-tracker/naima/` and checks it.

## What you get

- **You say what you want, agents build it**, with written requirements,
  tests, reviews and gates before anything ships.
- **Every claim comes with its evidence**: nothing counts as done until it is
  shown to be.
- **Formal methods applied for you**: properties of the design proven by
  tools, without your needing to know them.
- **Code-quality metrics per commit** — complexity, duplication, coverage —
  beside the tests, in a native window with `naima ui`.
- **A tracker in your repository**, plain files under git: items, decisions,
  plans and their proofs, managed for you.
- **Any project, not only software**: a data analysis checked by reproducible
  runs, a paper checked by reviews.

You don't need to know git, code or project management. You need an AI agent.

## Documentation

- [The documentation](docs/README.md), starting with
  [installing and updating](docs/guide/install.md).
- For agents: [the skill](skills/naima/SKILL.md).
- Contributing: Naima is developed in
  [vincenzoml/naima-dev](https://github.com/vincenzoml/naima-dev), which holds
  the tests, the site and Naima's own tracker.

## Licence

Apache License 2.0: [LICENSE](LICENSE), [NOTICE](NOTICE).
