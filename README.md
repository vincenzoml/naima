# Naima

Naima is a project tracker for software built by people and AI agents together: bugs, work, features, tests and the proofs that close them, kept as plain files in the repository and checked like code.

Formal-methods tools such as model checkers plug in, so that a property of
the software is tracked and proven the same way a test is.

Status: research project, open source, still taking shape. Open by design:
the file format is an open specification, and changing Naima to fit a project
is encouraged.

Why Naima exists, what it requires of itself and the principles behind it:
[purpose, requirements and principles](docs/purpose.md). Read it first.

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

## What it is

Every item — a bug, a task, a feature, a test, a property — is a directory:
`README.md` for the prose, `meta.json` for the fields, `attachments/` for the
evidence. Items have permanent ids and typed links. Boards, queues and gates
are derived when read and never stored, and `naima check` holds the tracker to
its invariants the way a test suite holds the code. A small core loads
plugins; everything else — item types, triage, gates, coordination across
branches, formal verifiers, the documentation rule — is a plugin.

## Quick start

Requires [Deno](https://deno.com) and git. No dependencies, no releases, no
binaries: a project carries one folder, `naima-tracker/`, and runs a clone of
Naima's `dist` branch inside it — only the files that run Naima — locked to
one commit. In the root of any git repository, one line does it all
(it installs Deno too, when it is missing):

```sh
curl -fsSL https://vincenzoml.github.io/naima/install.sh | sh     # macOS, Linux
irm https://vincenzoml.github.io/naima/install.ps1 | iex          # Windows PowerShell
```

Those lines, and a prompt that has an agent do it, are on [the site](https://vincenzoml.github.io/naima/)
(its source is `site/`). By hand, the same:

```sh
git clone --branch dist https://github.com/vincenzoml/naima.git naima-tracker/naima
deno run -A naima-tracker/naima/naima.ts init
deno run -A naima-tracker/naima/naima.ts new bugs "Export drops the alpha channel"
deno run -A naima-tracker/naima/naima.ts check
```

Details: [installing and updating](docs/install.md), [using Naima in your
project](docs/using-naima.md), [the format](docs/format.md). An agent can do
all of this itself: [the Naima skill](docs/skill.md).

## Documentation

**[Purpose, requirements and principles](docs/purpose.md)** — read first:
why Naima exists, whom it serves, what it requires of itself and what holds
each requirement, its design principles and its non-goals.

**[docs/](docs/README.md)** — concepts, configuration, the generated
reference of every command, type, field, relation, check, gate and plugin, the
plugin contract, the bootstrap policy, and the flows for people and AI agents.
Rules for working on this repository: [AGENTS.md](https://github.com/vincenzoml/naima/blob/main/AGENTS.md).

Naima tracks itself, in `naima-tracker/`, managed by a clone of its own
`dist`, locked by commit, as every project is (`deno task naima`);
`deno task verify` runs the typecheck, the tests, and `check` with both the
lock and the working tree: [Naima tracking itself](docs/bootstrap.md).

## Licence

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
