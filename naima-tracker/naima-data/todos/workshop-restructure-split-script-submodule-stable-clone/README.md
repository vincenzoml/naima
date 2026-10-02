# The move script and workshop restructure: product commit, submodule, stable clone, tasks and site deploy, rehearsed locally

Part of the epic "Product repo is the install; development in naima-dev"
(sections "The product's file list", "Order of operations" step 2, "The
workshop", "Where the site lives"). Everything here is local; nothing is
pushed to GitHub.

## Definition of done

- [ ] `scripts/split.sh <commit> [--product <url>] [--workshop <url>] [--dry-run]`,
  from a clean checkout at `<commit>`:
  - the product commit P on a branch `product-main`: `git mv` `naima/`'s
    content to the root (its `README.md`, `LICENSE`, `NOTICE` replacing the
    root's), `git rm -r` the workshop material of the epic's list; checks P's
    tree equals `<commit>:naima`'s tree;
  - the workshop commit W on a branch `workshop-main`, child of `<commit>`:
    `git rm -r naima`, `git submodule add <product url> naima` at P, the files
    below changed; `naima-tracker/naima/` replaced by a clone of the product at
    P, its lock recorded;
  - `--dry-run` prints each step; local bare `file://` remotes rehearse it.
- [ ] `deno.json`: `naima` = `deno run -A naima-tracker/naima/naima.ts`; `dev` =
  `deno run -A naima/src/cli.ts --data naima-tracker/naima-data`; `verify`'s
  last step uses the stable clone. `typecheck`, `fmt`, `lint`, `test` unchanged.
- [ ] `scripts/coverage.ts` maps `…/naima-tracker/naima/src/x.ts` to
  `naima/src/x.ts`.
- [ ] `.github/workflows/pages.yml`: on push to `naima-dev`'s `main`, build
  `site/` and push it to the product's `gh-pages` with the secret
  `PRODUCT_DEPLOY_KEY`; the star count read from `vincenzoml/naima`.
- [ ] `AGENTS.md`, `develop/bootstrap.md`, `develop/architecture.md`,
  `develop/README.md`: the submodule, the two-step commit (product pushed
  first, then the pointer), worktrees initialising the submodule with
  `--reference`, the stable clone and its update.

The `deno.json`, `pages.yml`, coverage and docs changes are written for the
workshop layout and applied by the script in W, not committed on today's
`main` (where they would break it): the script holds them as patches under
`scripts/split/`.

## Files

`scripts/split.sh` (new), `scripts/split/` (new: the workshop patches).

Sequential: after units 1–5 are merged on `main`.

## Proving gesture

A rehearsal from a green `main` with local bare remotes: P's tree equals
`naima/` at that commit and a clone of it holds no `test/`, `develop/` or
tracker; in the rehearsed workshop `perl -e 'alarm 900; exec @ARGV' deno task
verify`, `node --test` and `bun test` pass; the rehearsed installer installs
from the rehearsed product into a temporary host; a v1.0.0 lock in a
temporary host still aligns against the rehearsed product.

## Notes

### 2026-10-02 — Vincenzo Ciancia, on claude/split-restructure

Done on branch claude/split-restructure. `scripts/split.sh` (dry run by default, `--execute` to run; `--source`, `--commit` (default main), `--product` (default github.com/vincenzoml/naima.git), `--out` (default $TMPDIR/naima-split)) makes P on `split/product` (commit-tree of `<commit>:naima`, child of `<commit>`; its tree checked equal, no workshop file in it) and W on `split/workshop` (child of `<commit>`: naima/ a gitlink at P, `.gitmodules` to the product, `scripts/split/workshop.patch` applied — the new pages.yml pushing the site to the product's gh-pages with PRODUCT_DEPLOY_KEY and the star count of vincenzoml/naima, AGENTS.md, develop/bootstrap.md, architecture.md, README.md — the script and patch removed, and Naima's tracker moved by P's own `naima update`: lock 7ea8893 → P, data format 2 → 3, source the product URL). The branch names and flags follow the coordinator's brief, not the names first written above (product-main, workshop-main, --dry-run). Before P is pushed, the product is read from a local bare `<out>/product.git`. P and W carry `<commit>`'s date: a rerun of the same commit gave the same P and W. Needed no change in the workshop layout: deno.json (its tasks already name the stable clone and the submodule path), package.json, bunfig.toml, test imports, scripts/site.ts, scripts/coverage.ts (already maps `…/naima-tracker/naima/src/x.ts`). Changed on main, holding in both layouts: test/runtime-folder.test.ts reads the product's files with `git -C naima ls-files`; both READMEs link the website under the title, pinned by test/site.test.ts.

Rehearsal, 2026-10-02, from the branch head (P 62926b3, W c176c68), in the session scratchpad: in the W checkout with the submodule and the stable clone at P, `deno task verify` green (388 passed, 0 failed, both checks hold), `node --test` 388 pass 0 fail, `bun test` 388 pass 0 fail; site/install.sh with NAIMA_SOURCE the rehearsed product: fresh install exit 0 and check passes, rerun exit 0, from a subfolder installs at the root, outside a repository refused (exit 1); the installed naima-tracker/naima holds 0 `*.test.ts`, no AGENTS.md, no naima-tracker/. Not rehearsed: a v1.0.0 host's lock aligning against the rehearsed product. Before the real run: merge the docs unit (claude/split-docs) and the open unit; if they touch develop/bootstrap.md or AGENTS.md the patch applies with --3way or is regenerated.
