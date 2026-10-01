# Installing and updating Naima

How Naima reaches a project and stays the same for everyone on it. An agent
does all of this for you; this page is what it follows, for anyone who wants
to see or do it by hand. Just updating: [update Naima](update-naima.md).
Terms: [glossary](glossary.md).

Naima has no releases, no version numbers and no compiled binaries. A
project runs a copy of Naima's `naima/` folder, `naima-tracker/naima/`, at
one commit of its `main`, which the project locks; that commit is the
version. Deno runs the TypeScript directly.

## Deno, once per machine

Besides git, which an agent installs when it is missing
([git, handled for the owner](../agents/git-for-the-owner.md#1-have-git)),
Deno is the only thing installed on the machine, once, by its official
installer:

```sh
curl -fsSL https://deno.land/install.sh | sh     # macOS, Linux
irm https://deno.land/install.ps1 | iex          # Windows PowerShell
```

Nothing is installed globally for Naima itself: no `deno install -g`, no
package, no binary on the path. Each project carries the Naima it runs, so
two projects on one machine never share one, and never clash.

## Bootstrap a project

In the root of a git repository, one line, from [the site](https://vincenzoml.github.io/naima/):

```sh
curl -fsSL https://vincenzoml.github.io/naima/install.sh | sh     # macOS, Linux
irm https://vincenzoml.github.io/naima/install.ps1 | iex          # Windows PowerShell
```

The installer (`site/install.sh`, `site/install.ps1` on `main`) refuses
outside a git repository and needs git. When Deno is missing it installs it
with Deno's official installer, saying so; with `NAIMA_NO_DENO_INSTALL` set it
prints that command instead, and stops. Then it does the steps below, the
commit aside: it clones `main`, shallow, into a temporary folder, runs that
clone's `init` from the project, runs `naima check`, removes the temporary
clone, and prints what to do next. Run again in a project that has Naima, it
only says so and runs `naima check` (copying the program first when it is
missing): it never moves the lock, which is `naima update`'s job.
`NAIMA_SOURCE` and `NAIMA_REF` name another repository and branch to install
— a fork, or a path on this disk, as the installer's own tests do. For an
agent, the site's `llms.txt` says the same.

By hand, in a git repository that does not use Naima yet:

```sh
git clone --depth 1 https://github.com/vincenzoml/naima.git /tmp/naima
deno run -A /tmp/naima/naima/naima.ts init
rm -rf /tmp/naima
git add naima-tracker && git commit -m "Track this project with Naima"
```

`init` writes `naima-tracker/README.md`, `naima-tracker/.gitignore` (which
ignores `naima/`) and `naima-tracker/naima-data/naima.json`, locked to the
source and commit of the clone that ran it, and copies that commit's
`naima/` into `naima-tracker/naima/` ([the copy](#the-copy)). Nothing else in
the project is touched ([unless asked](#the-hosts-own-tools)). What goes in
the folder: [using Naima in your project](tracker-folder.md).

`init` locks only what everyone else can fetch: it refuses a clone with
uncommitted changes, or with a commit its origin does not have, and it drops
any credentials from the origin URL (`https://user:token@…` is written as
`https://…`) before the URL reaches `naima.json`, which is committed.

## The copy

`main` is where Naima is developed: its tests, its CI, the rules for working
on it (`AGENTS.md`, `.claude/`), and its own tracker. None of that belongs in
a project, where test runners, type-checkers and agent harnesses that walk
the file system would pick it up. So a project gets only the folder that
runs Naima:

- **One folder.** On `main`, the runtime is the folder `naima/`: `naima.ts`,
  `src/` (no test), `skills/naima/`, `docs/`, `README.md`, `LICENSE` and
  `NOTICE`. A project's `naima-tracker/naima/` holds a copy of exactly what
  `naima/` holds at the locked commit, as plain files, and one file more:
  `.naima-copy.json`, the source, the commit and each file's git blob id it
  is a copy of. Tests hold it to that: no test, no development file, no
  tracker [item](glossary.md#item), no agent rules, and every import and
  relative link of the copy resolving inside it.
- **Through a per-user cache.** The locked commit is fetched, shallow, into
  a bare repository per source in the user's cache — `NAIMA_CACHE` when set,
  else `~/Library/Caches/naima` on macOS, `$XDG_CACHE_HOME/naima` or
  `~/.cache/naima` on Linux, `%LOCALAPPDATA%\naima\cache` on Windows — and
  its `naima/` is checked out from there. A commit fetched once on a machine
  is copied again, into any project or worktree, without the network.
- **Locked to `main`.** The lock names a commit of `main`, the commit the
  copy came from; there is no other branch to build or follow, and a commit
  that changes nothing under `naima/` leaves the copy as it was.

A lock that names a commit of the `dist` branch — a branch whose commits
hold `naima/`'s files at their top, each with a `Source-Commit:` trailer
naming the `main` commit it holds — runs that commit as a gitignored clone.
`naima update` names it by its trailer's `main` commit, moves the lock to the
head of `main`, and turns the clone into a copy.

## The host's own tools

Git ignores the program directory, but some tools walk the file system
without reading `.gitignore`: even the runtime files of the copy reach
`deno check`, `tsc` and `prettier` in the project. None of them has a marker
a directory could carry, so the exclusion goes in the project's own
configuration. `init` prints one line for each configuration it finds:

| Found | Line |
|---|---|
| `deno.json`, `deno.jsonc` | `"exclude": ["naima-tracker/naima/"]` |
| `tsconfig.json` | `"exclude": ["node_modules", "naima-tracker/naima"]` (tsc drops its default exclusion once `exclude` is given) |
| `.prettierignore`, or a prettier configuration | `naima-tracker/naima/` |

With `naima init --write-excludes` it writes them: into the list a JSON file
already has, or a new one; a file with comments (JSONC) is left as it is, and
the line printed to add by hand. It is the only way Naima writes outside
`naima-tracker/`, and the launcher grants exactly these files, for that
command only. Test runners need nothing: the copy holds no tests.

A long command is worth an alias:

```sh
alias naima='deno run -A "$(git rev-parse --show-toplevel)/naima-tracker/naima/naima.ts"'
```

The rest of the documentation writes `naima <command>` for it.

## Every run aligns the program

Before it does anything else, every run makes `naima-tracker/naima/` exactly
the `source` and `commit` in `naima.json`, copying it when it is absent or a
copy of another commit. So a fresh clone of the project, a new
[worktree](glossary.md#worktree), a colleague and CI all run the same Naima.
Where the project has no program yet, there is no launcher in it either: run
the launcher of any Naima at hand from inside the project — the main
worktree's, say, or a clone's as the installer does. Either way, the run ends
aligned. Alignment:

- **never overwrites work.** When a file of the copy was changed, added or
  removed — its blob id is not the one `.naima-copy.json` records — it
  refuses and says: publish the change as a fork and set `source`. Modifying
  Naima is welcome ([below](#modifying-naima)); losing the modification
  silently is not.
- **refuses a commit it cannot reach**, naming the source and the commit:
  a rewritten history, or a deleted fork. Naima's own `main` is never
  rewritten.
- **needs git and the network once per commit and machine**, to fetch it
  into the cache. With nothing cached and no network it says so in one line.
  Once cached, every copy of that commit works offline.
- **fetches from this disk when it can.** Every git worktree of a project has
  its own ignored program directory; a new one is copied from the cache, and
  a commit missing there is fetched first from a repository on this disk
  that has it — the clone running the command, or the project itself when
  the project is Naima — so it is not downloaded again.
- **follows the lock, and says so.** A pulled `naima.json` whose `commit`
  moved — a teammate's `naima update`, merged — is followed, and the run
  prints `naima: locked commit moved <a> → <b>` once.
- **refuses a changed source.** A pulled `naima.json` whose `source` is not
  the one the program was aligned from is refused, naming both sources and
  both commits: Naima runs whatever that source holds, so a new one is
  trusted only on purpose. Review why it changed, then

  ```sh
  naima update --accept-source     # align to the locked commit of the new source; nothing else moves
  ```

  `naima update --check` still answers meanwhile: it only reads the source.
- **checks signatures, when asked.** With `"verify": "signed"` in
  `naima.json`, a commit is run, or updated to, only when `git verify-commit`
  verifies it, with the keys git is configured to trust (gpg, or ssh with
  `gpg.ssh.allowedSignersFile`). Otherwise it is refused, and the program
  stays where it was.
- **never pulls.** Running whatever lands on a branch would be a supply
  chain risk. Only `naima update` asks the source anything.

## Updating

```sh
naima update --check     # has the source's main moved past the lock? exit 1 when it has
naima update             # move the lock to it
```

`update` follows the source's `main`. It fetches that head into the cache,
copies its `naima/` into the program, migrates the data forward if its format
moved ([migrations](../reference/format.md#migrations)), and records the new
commit in `naima.json`. The copy is checked out beside the old program and
swapped in only once it is whole, so a failed update leaves the program that
ran before. The result is one change to review and commit like any other:

```sh
git add naima-tracker && git commit -m "Update Naima to <commit>"
```

"Explicit" means a deliberate command, not a human-only one: an agent runs
`naima update --check` at the start of a session and, when main has moved,
`naima update`, the checks, and the commit ([the skill](../agents/skill.md)). With
several branches open, update on a branch of its own and merge it first; the
others merge the [trunk](glossary.md#trunk) and run `naima update` again, which finishes the
migration of their new items or does nothing.

## The permissions

`naima.ts` is the launcher. It runs with every permission (`-A`), and all it
does is work out where the project and the program are and run the program
under Deno with only these:

| Permission | Granted | Why |
|---|---|---|
| read | the repository, the program wherever it is, the per-user cache, and the data directory of every other worktree of the project | items, the project's markdown and source (the docs and beta-marker checks read them), git's view of branches, the commits the program is copied from, and the uncommitted claims and notes of the other worktrees |
| write | `naima-tracker/` only, the data or program directory if moved out of it, and the per-user cache | items, claims, notes, the program's own alignment, the commits fetched for it; nothing else in the project |
| run | `git`, and the programs the loaded contributions declare | alignment, update and carry, and reading claims and notes across branches; a [verifier](glossary.md#verifier)'s model checker (its `runs`, [the contract](../reference/plugin-contract.md#the-verifier-contract)); a declared [metric](metrics-and-budgets.md)'s program, the first word of its `run` |
| env | an allow-list: `HOME`, `PATH`, the user, shell, terminal, locale and temporary-directory variables, the proxy variables, Windows' system ones, and every `NAIMA_*`, `GIT_*`, `SSH_*`, `LC_*` and `DENO_*` | what git needs to reach a source, and Naima's own; nothing else of the environment reaches the program, nor the git it runs |
| net | none | the network is git's, in alignment and update |

The list is `ENV` in `src/launcher.ts`. Deno cannot grant a named list of
variables and still let the program hand git its environment, so the
launcher enforces it by giving the program only those variables: an
unrelated secret, a cloud key say, is simply not there. The launcher names
the cache to the program as `NAIMA_CACHE`. Deno also splits its permission
lists on commas, so a project, or a program, whose path holds a comma is
refused in one line naming it; a cache whose path holds one is not granted,
and the program fetches into a scratch repository in the tracker folder,
removed after the copy.

A command that tries anything else fails with Deno's own error, for example
`Requires write access to "…/escaped.txt"` or `Requires run access to "ls"`.
One consequence: `naima docs --write` can write only inside the tracker
folder when launched; Naima's own repository regenerates its reference with
the development build (`deno task docs`).

**What this does not protect.** The permissions stop a bug, or a compromised
dependency, from reaching beyond `naima-tracker/` and `git`. They cannot stop a
malicious commit that a project has chosen to update to, because the launcher
is part of that commit. The protection against that is the update itself: it
is an explicit, reviewable commit in the project, and nothing moves the lock
without one.

## Modifying Naima

Naima is meant to be changed, on a full checkout of `main`, never in
`naima-tracker/naima/`: the copy there holds no tests to run. Clone Naima,
change it, and publish it as a fork; then set `source` in `naima.json` to the
fork and `commit` to your commit (or run `naima update` once the fork's `main`
has it). The whole team then runs that fork's `naima/` at that commit. A
plugin of your own lives in the fork's `naima/`, and `plugins` names it by its
path there — or, without a fork,
in the project or its own git repository, pinned by its hash or commit
([third-party plugins](config.md#third-party-plugins)).
Improvements go back through pull requests. The data stays compatible as long
as the fork keeps [the format](../reference/format.md).

## How the program is carried

By default the program is the copy, ignored by git. A project that prefers to
commit it can switch, and switch back, at any time:

```sh
naima carry vendored     # the same copy, committed as plain files
naima carry submodule    # a git submodule: the whole commit, its launcher in naima-tracker/naima/naima/
naima carry copy         # back to the ignored copy
```

Each switch stages exactly what it changed — under `naima-tracker/`, plus
`.gitmodules` in submodule mode — so it is one commit. The lock and `update`
work the same in every mode ([the format](../reference/format.md#how-the-program-is-carried)).
A submodule is git's own checkout of the source, so it holds all of the
commit, its tests and tracker included; the copy and vendored hold `naima/`
only.

## Other runtimes

The code uses the standard APIs that Deno, Node and Bun share, and has no
dependencies; its tests run on all three, on Linux and macOS. Windows is not
exercised by CI. Deno is the documented runtime
because of its permissions. Run directly with Node or Bun (`node
naima-tracker/naima/src/cli.ts <command>`), Naima works on the data, but it
does not align, update, or carry, and nothing fences it in.
