# Installing and updating Naima

Naima has no releases, no version numbers and no compiled binaries. A
project runs Naima from a git clone of its `dist` branch,
`naima-tracker/naima/`, locked to one commit; that commit is the version.
Deno runs the TypeScript directly.

## Deno, once per machine

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

In a git repository that does not use Naima yet:

```sh
git clone --branch dist https://github.com/vincenzoml/naima.git naima-tracker/naima
deno run -A naima-tracker/naima/naima.ts init
git add naima-tracker && git commit -m "Track this project with Naima"
```

`init` writes `naima-tracker/README.md`, `naima-tracker/.gitignore` (which
ignores `naima/`) and `naima-tracker/naima-data/naima.json`, locked to the
source and commit of the clone that ran it. Nothing else in the project is
touched ([unless asked](#the-hosts-own-tools)). What goes in the folder:
[using Naima in your project](using-naima.md).

`init` locks only what everyone else can fetch: it refuses a clone with
uncommitted changes, or with a commit its origin does not have, and it drops
any credentials from the origin URL (`https://user:token@…` is written as
`https://…`) before the URL reaches `naima.json`, which is committed.

## The dist branch

`main` is where Naima is developed: its tests, its CI, the rules for working
on it (`AGENTS.md`, `.claude/`), and its own tracker. None of that belongs in
a project, where test runners, type-checkers and agent harnesses that walk
the file system would pick it up. So a project clones `dist`, a branch that
holds only what runs Naima, the way an npm package ships only its `files`
and a GitHub Action ships a built branch:

- **One allowlist.** `dist.json`, on `main`, names the files that ship:
  `naima.ts`, `src/**/*.ts` except the tests and `src/core/testing.ts`,
  `docs/`, `skills/naima/`, `README.md`, `LICENSE` and `NOTICE`. Nothing
  else reaches a project. A test holds it to that: no test, no development
  file, no tracker item, and every import and relative link of what ships
  resolving inside it.
- **Built by CI from every commit of `main`**, with `scripts/dist.ts`, and
  pushed after the checks pass. A dist commit carries the trailer
  `Source-Commit: <sha>`, the `main` commit it was built from.
- **Reproducible.** The dist commit is made from the `main` commit's own
  tree, with its date and a fixed author, so the same `main` commit always
  gives the same dist tree, and on the same history the same commit:
  `deno run -A scripts/dist.ts` rebuilds it anywhere. A `main` commit that
  changes no shipped file adds no dist commit, so a project is never asked to
  update for a change it would not run.
- **Never rewritten.** Each dist commit's parent is the previous one, so a
  locked commit stays fetchable.

A lock on a commit of `main` — every project installed before the dist
existed — keeps working: alignment runs any commit the source has. `naima
update` moves it onto the dist. When the locked commit predates the dist,
that takes two updates: the first reaches the `main` that knows the dist,
the second the dist itself.

## The host's own tools

Git ignores the program directory, but some tools walk the file system
without reading `.gitignore`: even the runtime files the dist holds reach
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
command only. Test runners need nothing: the dist holds no tests.

A long command is worth an alias:

```sh
alias naima='deno run -A "$(git rev-parse --show-toplevel)/naima-tracker/naima/naima.ts"'
```

The rest of the documentation writes `naima <command>` for it.

## Every run aligns the program

Before it does anything else, every run makes `naima-tracker/naima/` exactly
the `source` and `commit` in `naima.json`, cloning it when it is absent. So a
fresh clone of the project, a new worktree, a colleague and CI all run the
same Naima. Where the project has no program yet, there is no launcher in it
either: clone the `source` into `naima-tracker/naima/`, or run the launcher of
any Naima at hand from inside the project — the main worktree's, say. Either
way, the run ends aligned. Alignment:

- **never overwrites work.** When the program directory has uncommitted
  changes, or commits its source does not have, it refuses and says: publish
  them as a fork and set `source`. Modifying Naima is welcome
  ([below](#modifying-naima)); losing the modification silently is not.
- **refuses a commit it cannot reach**, naming the source and the commit:
  a rewritten history, or a deleted fork. Naima's own `main` is never
  rewritten.
- **needs git and the network once**, to clone. With no clone and no
  network it says so in one line. Once cloned, every run works offline.
- **clones from this disk when it can.** Every git worktree of a project has
  its own ignored program directory; a new one is cloned from the main
  worktree's, or from the project itself when the project is Naima (whose
  dist commits are there once `origin/dist` is fetched), so it is not
  downloaded again.
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
naima update --check     # has the source's dist moved past the lock? exit 1 when it has
naima update             # move the lock to it
```

`update` follows the source's `dist` branch, or its `main` when the source
publishes no dist (a fork, a local source). It fetches that head, moves the
program to it, migrates the
data forward if its format moved ([migrations](format.md#migrations)), and
records the new commit in `naima.json`. A vendored program is checked out
beside the old one and swapped in only once it is whole, so a failed update
leaves the program that ran before. The result is one change to review and
commit like any other:

```sh
git add naima-tracker && git commit -m "Update Naima to <commit>"
```

"Explicit" means a deliberate command, not a human-only one: an agent runs
`naima update --check` at the start of a session and, when the dist has moved,
`naima update`, the checks, and the commit ([the skill](skill.md)). With
several branches open, update on a branch of its own and merge it first; the
others merge the trunk and run `naima update` again, which finishes the
migration of their new items or does nothing.

## The permissions

`naima.ts` is the launcher. It runs with every permission (`-A`), and all it
does is work out where the project and the program are and run the program
under Deno with only these:

| Permission | Granted | Why |
|---|---|---|
| read | the repository, the program wherever it is, and the data directory of every other worktree of the project | items, the project's markdown and source (the docs and beta-marker checks read them), git's view of branches, and the uncommitted claims and notes of the other worktrees |
| write | `naima-tracker/` only, and the data or program directory if moved out of it | items, claims, notes, the program's own alignment; nothing else in the project |
| run | `git`, and the programs the loaded contributions declare | alignment, update and carry, and reading claims and notes across branches; a verifier's model checker (its `runs`, [the contract](plugin-contract.md#the-verifier-contract)) |
| env | an allow-list: `HOME`, `PATH`, the user, shell, terminal, locale and temporary-directory variables, the proxy variables, Windows' system ones, and every `NAIMA_*`, `GIT_*`, `SSH_*`, `LC_*` and `DENO_*` | what git needs to reach a source, and Naima's own; nothing else of the environment reaches the program, nor the git it runs |
| net | none | the network is git's, in alignment and update |

The list is `ENV` in `src/launcher.ts`. Deno cannot grant a named list of
variables and still let the program hand git its environment, so the
launcher enforces it by giving the program only those variables: an
unrelated secret, a cloud key say, is simply not there. Deno also splits its
permission lists on commas, so a project, or a program, whose path holds a
comma is refused in one line naming it.

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
`naima-tracker/naima/`: the dist there holds no tests to run. Clone Naima,
change it, and publish it as a fork; then set `source` in `naima.json` to the
fork and `commit` to your commit (or run `naima update` once the fork's `main`
has it). A fork with no `dist` branch is followed on its `main`; one that
builds its own dist (`deno run -A scripts/dist.ts`, then push `dist`) is
followed there. The whole team then runs that fork at that commit. A plugin of your own lives
in the fork, and `plugins` names it by its path there — or, without a fork,
in the project or its own git repository, pinned by its hash or commit
([third-party plugins](config.md#third-party-plugins)).
Improvements go back through pull requests. The data stays compatible as long
as the fork keeps [the format](format.md).

## How the program is carried

By default the program is a clone, ignored by git. A project that prefers to
commit it can switch, and switch back, at any time:

```sh
naima carry vendored     # the program committed as plain files
naima carry submodule    # a git submodule
naima carry clone        # back to the ignored clone
```

Each switch stages exactly what it changed — under `naima-tracker/`, plus
`.gitmodules` in submodule mode — so it is one commit. The lock and `update`
work the same in every mode ([the format](format.md#how-the-program-is-carried)).

## Other runtimes

The code uses the standard APIs that Deno, Node and Bun share, and has no
dependencies; its tests run on all three, on Linux and macOS. Windows is not
exercised by CI. Deno is the documented runtime
because of its permissions. Run directly with Node or Bun (`node
naima-tracker/naima/src/cli.ts <command>`), Naima works on the data, but it
does not align, update, or carry, and nothing fences it in.
