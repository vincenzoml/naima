# Product repo is the install; development in naima-dev

Two repositories. `naima` (the product) holds exactly what `naima/` holds today:
`naima.ts`, `src/`, `docs/`, `skills/`, `README.md`, `LICENSE`, `NOTICE`. Cloning
it is installing it. `naima-dev` (the workshop, today's repository renamed) holds
`test/`, `scripts/`, `site/`, `develop/`, `AGENTS.md`, `CLAUDE.md`, `.claude/`,
`.github/`, `deno.json`, `package.json`, `bunfig.toml` and Naima's own tracker.

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
  lacks is refused with one line, as today.
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

`git subtree split --prefix=naima <last monorepo commit> -b product-main`: the
product gets the history of `naima/` only, with new commit ids. `naima-dev`
keeps the full history unchanged, so every tracker record keyed by a commit
(metrics files, `commits` fields, sessions) stays valid. The split is proven by
`git rev-parse product-main^{tree}` equal to `git rev-parse <commit>:naima`.
The `v1.0.0` tag is mapped to the split commit of the same tree and pushed to
the product. The old full history is also pushed to the product as
`refs/legacy/main`: not fetched by `git clone`, but fetchable by commit id, so
a v1.0.0 host that has not migrated keeps aligning its copy (its lock names a
monorepo commit and its source URL is `github.com/vincenzoml/naima`).

### GitHub moves (outward-facing: coordinator and owner only)

Order, with every local artefact (split branch, workshop restructure commit,
built site) prepared and verified before step 1, so the window between 1 and 5
is minutes:

1. Tag `pre-split` on the monorepo `main`; push it.
2. Rename `vincenzoml/naima` to `vincenzoml/naima-dev`. From now on
   `github.com/vincenzoml/naima` redirects to `naima-dev`; Pages moves to
   `/naima-dev/`, so the site and the installer URL are down.
3. `git remote set-url origin https://github.com/vincenzoml/naima-dev.git` in
   every local clone of the workshop.
4. Create the empty public `vincenzoml/naima` (no README, no licence): the
   redirect ends, the new repository wins. Push `product-main` as `main`, the
   mapped tags, and `refs/legacy/main`.
5. Pages: add a write deploy key on the product and its private half as the
   secret `PRODUCT_DEPLOY_KEY` on `naima-dev`; set the product's Pages source to
   the branch `gh-pages`; disable Pages on `naima-dev`; push the workshop's
   restructure commit; its `pages.yml` builds the site and pushes it to the
   product's `gh-pages`. Proven by `curl -fsS
   https://vincenzoml.github.io/naima/install.sh` returning the new installer.
6. Migrate Naima's own tracker in `naima-dev` (installer rerun), then each host
   (the paper repository first), each as one commit.

### Where the site lives

Source in `naima-dev/site/`, built by `naima-dev`'s `pages.yml`, published to
the product's orphan branch `gh-pages` (Pages from a branch). The URL is the
product's, so it survives; the product's `main` stays clean; the installer
clones `--single-branch`, so `gh-pages` never reaches a host. The star count
is read from `vincenzoml/naima` by name, not from `github.repository`.

### The workshop

```
naima-dev/naima/                 the product under development: git submodule, url github.com/vincenzoml/naima
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

## Order of the work

1. Program as a git clone (core) — first; everything else builds on it.
2. Then in parallel: installer; `naima open` program clone; metrics through
   submodules; product docs.
3. Workshop restructure and split script, rehearsed end to end with local
   `file://` remotes.
4. Outward: the GitHub moves above, then the migrations.

Units 1–3 land on today's `main` (monorepo) and keep `deno task verify` green
there; the split happens once, at the end, from a green `main`.

## Rollback

- Before step 4 of the moves: rename `naima-dev` back to `naima`; Pages comes
  back at `/naima/`; nothing else changed.
- After step 4: the new product repository can be deleted (owner only,
  irreversible) and `naima-dev` renamed back; `pre-split` marks the monorepo
  state; hosts already migrated return to a copy by running the `pre-split`
  installer (`site/install.sh` at that tag) with
  `NAIMA_SOURCE=https://github.com/vincenzoml/naima-dev.git`.
- Every host migration is one commit, reverted with `git revert`; the legacy
  program folder is kept aside until the host's next `check` passes.

## Risks

- Every Naima change now needs two commits in two repositories, in order.
  The flows for closing a worktree carry it for `naima-dev` only
  (`develop/bootstrap.md`), not for hosts.
- The v1.0.0 program's own `naima update` cannot reach the new layout (it
  expects `naima/src/cli.ts` at the head): migration is the installer rerun.
- **Open for the owner:** the rename moves the stars, watchers, issues, the
  v1.0.0 Release and the Pages settings to `naima-dev`; the new product
  repository starts at zero stars, and the site shows the product's count. The
  alternative is to keep `vincenzoml/naima` as the product (force-push the
  split history to its `main`, keeping the old history as `refs/legacy/main`)
  and push the full history to a new `naima-dev`: no redirect, no site
  downtime, stars stay with the product, but published history is rewritten.

## Units

1. The program is a git clone of the product (core).
2. The installer clones and migrates a legacy copy.
3. `naima open` clones the program locally into the new worktree.
4. Code metrics read submodule files.
5. The product's documentation.
6. The workshop restructure and split script (rehearsed locally).
7. Outward: GitHub moves and migrations (coordinator and owner).
