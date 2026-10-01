# Naima

Naima turns your AI agents into a small team that works quietly for you. You say what you want. Agents do the work — code, analyses, drafts — check it, prove it and document it, and every claim comes with its evidence: nothing counts as done until it is shown to be. You only decide.

Software, a data analysis, a paper written with colleagues — or all of them in one repository.
It lives in one folder of your repository, and never gets in your way.

**You don't need to know git, code or project management. You need an AI agent — Naima does the rest.**

## Install

In the root of a git repository, one line. It sets up everything it needs:
it installs [Deno](https://deno.com) when it is missing, and says how to
install git if that is missing.

```sh
curl -fsSL https://vincenzoml.github.io/naima/install.sh | sh     # macOS, Linux
irm https://vincenzoml.github.io/naima/install.ps1 | iex          # Windows PowerShell
```

Or ask your agent: *Please install https://github.com/vincenzoml/naima in this repository.*

### If you are the agent asked to install it

If git is not installed, install it (macOS: `xcode-select --install`, or `brew install git` with Homebrew; Linux: the package manager, e.g. `sudo apt install git`; Windows: `winget install Git.Git`), then work from the root of the git repository
(`git rev-parse --show-toplevel`; `git init` makes one), and do these steps in
order.

1. Run the installer line above for this system. It clones Naima into
   `naima-tracker/naima/` (ignored by git), writes `naima-tracker/` and nothing
   else, and checks it. Outside a git repository it refuses.
2. Check it: `deno run -A naima-tracker/naima/naima.ts check` must end with
   `all invariants hold`.
3. Commit it: `git add naima-tracker && git commit -m "Track this project with Naima"`.
4. Read `naima-tracker/naima/skills/naima/SKILL.md` and work by it, and read
   the project's rules: `naima rules --audience agents`. Here `naima` means
   `deno run -A naima-tracker/naima/naima.ts`.
5. Add this line, verbatim, to the agent instruction file this repository
   has — `AGENTS.md`, `CLAUDE.md`, or whichever file you read; if there is none,
   create `AGENTS.md` — and commit it:

   ```text
   This repository tracks its work with Naima: at the start of every session read naima-tracker/naima/skills/naima/SKILL.md and `naima rules --audience agents`, and work by them.
   ```

By hand, without the installer:

```sh
git clone --branch dist https://github.com/vincenzoml/naima.git naima-tracker/naima
deno run -A naima-tracker/naima/naima.ts init
deno run -A naima-tracker/naima/naima.ts check
```

## Documentation

**[The documentation map](naima/docs/README.md)** — where to start, by who you are:

- **[purpose](naima/docs/purpose.md)**: why Naima exists and whom it serves;
- **[the guide](naima/docs/guide/README.md)**, for people: a
  [tutorial](naima/docs/guide/tutorial.md), a page per everyday task,
  [installing and updating](naima/docs/guide/install.md), and
  **[the rules](naima/docs/guide/rules.md)** every project holds to;
- **[for agents](naima/docs/agents/README.md)**: the skill and the flows;
- **reference**: [the format](naima/docs/reference/format.md) of every file,
  and [every command and field](naima/docs/reference/reference.md);
- **[developing Naima](develop/README.md)**, and the rules for working on this
  repository: [AGENTS.md](AGENTS.md).

## Why the name

**Coltrane.** *Naima* is John Coltrane's ballad on *Giant Steps* (1959). It is
built on pedal points: bass notes that hold still while the harmony above them
keeps moving. That is the architecture here — a small core that does not move,
and everything built on it free to change. It comes from the album where
Coltrane took harmonic rigour furthest, and it is the calmest, simplest piece
on it: rigour and beauty in the same place.

**Anima.** *Naima* is an anagram of *anima*, the soul: what makes a thing alive
from the inside. The tool is not the project; it is what keeps the project
alive and coherent as it grows.

**AI.** The name contains it. The work this tool organises is done more and
more by agents, and the tool is designed for them as much as for people.

**The word.** In Arabic, *naʿīma* means grace and calm. Five letters, said the
same way in every language, nothing to explain.

## Licence

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
