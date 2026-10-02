# Product repo is the install; development in naima-dev

Two repositories, both with today's full history.

- `vincenzoml/naima` stays the product: same URL, stars, issues, the v1.0.0
  Release and Pages. One ordinary commit (no rename, no force-push) moves
  `naima/`'s content to the root and deletes the workshop material. Cloning it
  is installing it.
- `vincenzoml/naima-dev` is a new repository, pushed with the same full
  history; its first own commit removes the product files and adds `naima/` as
  a submodule of `github.com/vincenzoml/naima`.

### The product's file list (after the move commit)

Kept at the root, moved from `naima/`: `naima.ts`, `src/`, `docs/`, `skills/`,
`README.md`, `LICENSE`, `NOTICE` (`naima/`'s copies replace the root's
`README.md`, `LICENSE` and `NOTICE`). Nothing else: no `deno.json` (the
launcher runs with `--no-config`), no `.gitignore`, no `.github/`.

Deleted from the product: `test/`, `scripts/`, `site/`, `develop/`,
`AGENTS.md`, `CLAUDE.md`, `.claude/`, `.github/` (so `pages.yml`), `deno.json`,
`package.json`, `bunfig.toml`, `naima-tracker/` (Naima's own tracker lives on in
`naima-dev`). All of it stays reachable in the product's history.

## Decisions

### Layout of a host

```
<host>/naima-tracker/          versioned: README.md, .gitignore ("/naima/")
<host>/naima-tracker/naima/      a git clone of the product, gitignored
<host>/naima-tracker/naima-data/ versioned: naima.json and the items
```

- **Data discovery.** `--data`, then `NAIMA_DATA`, then the sibling of the
  program directory: `dirname(program)/naima-data`. The walk up from the
  current directory goes: one rule, the program knows where its data is from
  where it is. The parent folder is called `naima-tracker/` by the installer,
  but any name works.
- **Self-init.** When the sibling `naima-data/` is absent, the program creates
  it (and the parent's `README.md` and `.gitignore` when absent) on its first
  run — only when the parent folder is inside a git work tree; outside one it
  refuses with the installer's outside-repository message. This is what
  `naima init` does; a plain `git clone` followed by any command gives the same
  result as the installer.
- **The lock is git.** `naima.json` keeps `source` (the clone's `origin` URL,
  credentials stripped) and `commit` (a commit of the product's `main`). The
  launcher compares `commit` with the clone's `HEAD`; on a mismatch it fetches
  the commit (from a local seed first — the main worktree's
  `naima-tracker/naima/` — then `origin`), checks it out detached, and
  relaunches (the existing exit code 75 hand-over). `naima update` = `git fetch
  origin main` + checkout of its head + data migration + record `commit`, as
  one change to commit in the host. A lock that names a commit the source
  lacks is refused with one line, as today. A lock naming a commit of the old
  layout (it holds `naima/src/cli.ts`) is moved by `naima update` to the
  product head: that is the migration.
- **Removed:** copy-on-install (`.naima-copy.json`, the blob manifest,
  `copyProgram`), the per-user cache (`NAIMA_CACHE`, `cacheDir`, the scratch
  `.naima-fetch`), carry modes (`naima carry`, `CARRY_MODES`, `carry` in
  `naima.json`, removed by a format migration), the `dist` branch handling
  (`distSource`, `Source-Commit:` trailer, `lockedDist`).
- **Kept:** the host-tool exclusions (`init --write-excludes`). They are not
  obsolete: the clone holds the same runtime `.ts` files the copy held, and
  `deno check`, `tsc` and `prettier` walk them regardless of `.gitignore`. Kept
  too: `--write-agent-pointer`, the launcher's permission fence (read the
  repository, write the parent folder), the comma refusal, the env allow-list.
- **Agent pointer.** The installer (and `init --write-agent-pointer`) adds one
  line to the host's `AGENTS.md`, else `CLAUDE.md`, else creates `AGENTS.md`:
  "Naima is in naima-tracker/ (naima/ the program, naima-data/ the data); if
  you find it elsewhere, update this line". The line names the parent folder
  actually used. The versioned `naima-tracker/README.md` holds the two commands
  that restore a missing program: `git clone <source> naima-tracker/naima` and
  any `naima` command (which then aligns to the lock).
- **Fresh clones and worktrees of a host.** A fresh clone has `naima-data/`
  but no `naima/`: rerun the installer (it sees the lock and clones at the
  locked commit), or the two README commands. `naima open` creates the new
  worktree's `naima-tracker/naima/` as a local clone of the current one
  (`git clone --local`, then checkout of the lock): no network.

### Installer

`site/install.sh` and `site/install.ps1`, still served at
`https://vincenzoml.github.io/naima/install.sh` and `/install.ps1`. Steps: find
git; find the repository root (refuse outside one with today's message); install
Deno if missing (`NAIMA_NO_DENO_INSTALL` kept); `git -c core.autocrlf=false clone
--single-branch --branch $NAIMA_REF $NAIMA_SOURCE naima-tracker/naima` (no
temporary clone any more; `NAIMA_REF` may be a tag, which fixes the tagged-release
refusal); run `naima init` from the clone (writes `.gitignore`, `README.md`,
`naima-data/naima.json`, the agent pointer); run `naima check`. Run again on a
host that has a lock: clone if `naima/` is missing, then `check`. On a host
whose `naima/` is a legacy copy (it holds `.naima-copy.json`) or a legacy clone
of the old full repository (its `HEAD` holds `naima/src/cli.ts`): move it aside
to `naima-tracker/.naima-legacy-<date>`, clone the product, run `naima update`
— this is the migration of existing hosts.

### History

No rewrite anywhere. The product keeps every commit id, so a v1.0.0 host's lock
(a commit of the old layout, source `github.com/vincenzoml/naima`) still
aligns its copy unchanged: the v1.0.0 program fetches that commit from the
same URL and finds `naima/` in it. Only its `naima update` fails — the head no
longer holds `naima/src/cli.ts` — and the host migrates by rerunning the
installer. `naima-dev` has the same history up to the move, so every tracker
record keyed by a commit (metrics files, `commits` fields, sessions) stays
valid there.

### Order of operations

Every outward step (marked OUT) is the coordinator's or the owner's, never a
worker's.

1. Units 1–5 land on today's `main` (one repository) and keep
   `deno task verify` green there.
2. Rehearse locally (unit 6): from a green `main`, the move script makes the
   product commit P and the workshop commit W against local bare `file://`
   remotes; verify, Node and Bun pass in the rehearsed workshop; the rehearsed
   installer installs from the rehearsed product into a temporary host.
3. OUT: tag `pre-split` on `main` and push it. Create the empty
   `vincenzoml/naima-dev` (owner) and push `main` as it is, with every tag.
4. OUT: push P to `vincenzoml/naima` `main`. Pages keeps serving its last
   deployment: deleting `pages.yml` does not unpublish it.
5. OUT: push W (submodule at P, the tracker's stable clone, the new
   `pages.yml`) to `naima-dev`. A workshop commit is pushed only after the
   product commit it points at.
6. OUT: Pages — a write deploy key on the product, its private half as the
   secret `PRODUCT_DEPLOY_KEY` on `naima-dev`; `naima-dev`'s `pages.yml` pushes
   the built site to the product's `gh-pages`; then the product's Pages source
   is switched from GitHub Actions to the branch `gh-pages`. Proven by `curl
   -fsS https://vincenzoml.github.io/naima/install.sh` returning the new
   installer.
7. OUT: migrate Naima's own tracker in `naima-dev` (installer rerun, one
   commit), then the paper repository and any other host.

### Where the site lives

Source in `naima-dev/site/`, built by `naima-dev`'s `pages.yml`, pushed to the
product's orphan branch `gh-pages`; the product's Pages serves that branch. A
Pages artifact would need a workflow in the product, so the branch is the
simplest way to keep the product's `main` free of `.github/`. The installer
clones `--single-branch`, so `gh-pages` never reaches a host. The star count is
read from `vincenzoml/naima` by name, not from `github.repository`.

### The workshop

```
naima-dev/naima/                 the product under development: git submodule, url github.com/vincenzoml/naima, at the product commit W points at
naima-dev/naima-tracker/naima/   a stable clone of the product, gitignored
naima-dev/naima-tracker/naima-data/  Naima's own tracker, versioned
```

- **Tests** import `../naima/src/...` exactly as today: the submodule sits at the
  same path, so no import changes. `deno task test`, `node --test
  "test/**/*.test.ts"` and `bun test` run unchanged from the workshop root.
  Tests that install Naima build a product-layout source repository from the
  files of `naima/` (`git -C naima ls-files`) committed in a temporary repo, so
  they pass before and after the split.
- **deno.json tasks:** `naima` = `deno run -A naima-tracker/naima/naima.ts`
  (the stable clone; its sibling is the tracker); `dev` = `deno run -A
  naima/src/cli.ts --data naima-tracker/naima-data` (the working tree, never
  the authority); `verify` ends with the stable clone's `check`.
- **A developer commits** in the submodule on a branch, merges it into the
  product's `main` and pushes it; only then commits the new submodule pointer
  in `naima-dev`. A workshop commit never points at a product commit that is
  not on the product's `origin`. A worker's worktree of `naima-dev` gets its
  submodule with `git submodule update --init --reference <main worktree>/naima`
  (no network), on a product branch of the same name as the workshop branch.
- **The stable clone moves** as every host's does: once the product change is
  on `main`, `deno task naima update`, committed in `naima-dev`. The rule "the
  lock moves after the change is on main" is unchanged.
- **Metrics.** The code metrics read files through `git ls-files` and `git
  ls-tree`, which do not enter a submodule: after the split every code metric of
  `naima-dev` would read `naima/src` as empty. The code measure therefore
  follows a gitlink into the submodule's objects (`ls-files
  --recurse-submodules`; for a past commit, `ls-tree` of the gitlink's commit in
  the submodule's repository). Records before the split are unaffected.
- **Coverage script** (`scripts/coverage.ts`) maps a stable-clone path
  `…/naima-tracker/naima/src/x.ts` to `naima/src/x.ts`, as it maps a copy today.

### Docs, skill, guide

- `naima guide` and the skill point to the running program's own files, as
  today: now files of the clone.
- Product pages that link to `develop/` use
  `https://github.com/vincenzoml/naima-dev/blob/main/develop/...`; the link
  test holds every relative link inside the product and every absolute link
  into `naima-dev` to a page that exists in the workshop.
- `docs/agents/release.md`: a Naima version tag goes on the product.
- `develop/bootstrap.md` and `AGENTS.md` describe the submodule and the stable
  clone; `docs/guide/install.md` loses "The copy", the per-user cache and "How
  the program is carried".

### Windows

`install.ps1` is the same steps; the clone is made with `core.autocrlf=false`
recorded in its local config, so every later checkout keeps LF. No symlinks;
a path with a comma is still refused.

### Offline

Install and `naima update` need the network. Alignment of a worktree or a
second clone uses a local seed first (another worktree's program clone); a
fresh clone of a host on another machine needs the network once.

## Rollback

- Before step 4: nothing public changed but a new repository; delete
  `naima-dev` (owner) if wanted.
- After step 4: `git revert P` on the product restores the old layout as a new
  ordinary commit; the Pages source goes back to GitHub Actions and the old
  `pages.yml` returns with the revert. Hosts already migrated run the
  `pre-split` installer (`site/install.sh` at that tag) to return to a copy.
- Every host migration is one commit, reverted with `git revert`; the legacy
  program folder is kept aside until the host's next `check` passes.

## Risks

- Every Naima change needs two commits in two repositories, in order: product
  pushed first, then the workshop pointer. `develop/bootstrap.md` carries it
  for `naima-dev` only, not for hosts.
- The product's clone carries the full history (the old tests and tracker in
  past commits): a bigger first clone, the price of keeping every commit id.
- The v1.0.0 program's own `naima update` cannot reach the new layout:
  migration is the installer rerun (decided).

## Units

1. The program is a git clone of the product (core) — first.
2. The installer clones and migrates a legacy copy — after 1.
3. `naima open` clones the program locally into the new worktree — after 1.
4. Code metrics read submodule files — independent, now.
5. The product's documentation — after 1.
6. The move script and workshop restructure, rehearsed locally — after 1–5.
7. OUT: create `naima-dev`, push, product commit, Pages, migrations — after 6.
