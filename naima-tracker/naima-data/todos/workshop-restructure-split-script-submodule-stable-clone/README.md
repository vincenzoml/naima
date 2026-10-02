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
