# The workshop restructure: split script, submodule, stable clone, tasks and site deploy

Part of the epic "Product repo is the install; development in naima-dev"
(sections "History", "The workshop", "Where the site lives"). Everything in it
is local and rehearsed; nothing is pushed to GitHub.

## Definition of done

- [ ] `scripts/split.sh <commit> <product-remote> <workshop-remote>`: `git subtree
  split --prefix=naima` into `product-main`; checks `product-main^{tree}` equals
  `<commit>:naima`; maps each tag whose commit's `naima/` tree matches a split
  commit; prepares `refs/legacy/main`; in the workshop, `git rm -r naima`,
  `git submodule add <product-url> naima` at the split head, replaces
  `naima-tracker/naima/` with a clone of the product. `--dry-run` prints each
  step; `--remote file://…` rehearses against local bare repositories.
- [ ] `deno.json`: `naima` = `deno run -A naima-tracker/naima/naima.ts`; `dev` =
  `deno run -A naima/src/cli.ts --data naima-tracker/naima-data`; `verify`'s
  last step uses the stable clone. `typecheck`, `fmt`, `lint`, `test` unchanged.
- [ ] `scripts/coverage.ts` maps `…/naima-tracker/naima/src/x.ts` to
  `naima/src/x.ts`.
- [ ] `.github/workflows/pages.yml`: on push to `main` of `naima-dev`, build
  `site/` and push it to the product's `gh-pages` with the deploy key secret
  `PRODUCT_DEPLOY_KEY`; the star count read from `vincenzoml/naima`.
- [ ] `AGENTS.md`, `develop/bootstrap.md`, `develop/architecture.md`,
  `develop/README.md`: the submodule, the two-step commit (product pushed
  first, then the pointer), worktrees initialising the submodule with
  `--reference`, the stable clone and its update.

## Files

`scripts/split.sh` (new), `scripts/coverage.ts`, `deno.json`, `AGENTS.md`,
`develop/bootstrap.md`, `develop/architecture.md`, `develop/README.md`,
`.github/workflows/pages.yml`, `test/arch.test.ts` if a path moves.

Sequential: after units 1–5 are merged on `main`.

## Proving gesture

A rehearsal from a green `main` with local bare remotes: the script produces a
product whose `main` tree equals `naima/` at that commit and whose clone holds
no `test/`, `develop/` or tracker; in the rehearsed workshop `perl -e 'alarm
900; exec @ARGV' deno task verify`, `node --test` and `bun test` pass; the
rehearsed installer installs from the rehearsed product into a temporary host.
